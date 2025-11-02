<template>
	<el-card class="box-card" shadow="hover" style="height: 100%" body-style="height:100%; overflow:auto">
		<template #header>
			<div class="card-header">
				<div class="tree-h-flex" v-if="!props.tenantId">
					<el-select v-if="userStore.userInfos.accountType == 999" v-model="state.tenantId" @change="initTreeData()" placeholder="请选择租户" class="w100 mb10">
						<el-option :value="item.value" :label="`${item.label} (${item.host})`" v-for="(item, index) in state.tenantList" :key="index" />
					</el-select>
				</div>
				<div class="tree-h-flex">
					<div class="tree-h-left">
						<el-input :prefix-icon="Search" v-model="filterText" placeholder="机构名称" />
					</div>
					<div class="tree-h-right">
						<el-dropdown @command="handleCommand">
							<el-button style="margin-left: 8px; width: 34px">
								<el-icon class="el-icon--center">
									<more-filled />
								</el-icon>
							</el-button>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item command="expandAll">全部展开</el-dropdown-item>
									<el-dropdown-item command="collapseAll">全部折叠</el-dropdown-item>
									<el-dropdown-item command="rootNode">根节点</el-dropdown-item>
									<el-dropdown-item command="refresh">刷新</el-dropdown-item>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
					</div>
				</div>
			</div>
		</template>
		<div style="margin-bottom: 45px" v-loading="state.loading">
			<el-tree
			ref="treeRef"
			class="filter-tree"
			:data="state.orgData"
			node-key="id"
			:props="{ 
				children: 'children', 
				label: (node: any) => t(`org.${node.name}`) || node.name 
			}"
			:filter-node-method="filterNode"
			@node-click="nodeClick"
			:show-checkbox="state.isShowCheckbox"
			:default-checked-keys="state.ownOrgData"
			highlight-current
			check-strictly
		>
			<template #default="{ node }">
				<el-icon v-if="node.level == 1" size="16" style="margin-right: 3px; display: inline; vertical-align: middle"><ele-School /></el-icon>
				<el-icon v-else-if="node.level == 2" size="16" style="margin-right: 3px; display: inline; vertical-align: middle"><ele-PriceTag /></el-icon>
				<el-icon v-else size="16" style="margin-right: 3px; display: inline; vertical-align: middle"><ele-CollectionTag /></el-icon>
				{{ t(`org.${node.name}`) || node.name }}
			</template>
		</el-tree>
		</div>
	</el-card>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref, watch, onBeforeUnmount } from 'vue';
import type { ElTree } from 'element-plus';
import { Search, MoreFilled } from '@element-plus/icons-vue';
import * as SignalR from '@microsoft/signalr';
import { ElNotification } from 'element-plus';
import { getToken } from '/@/utils/axios-utils';

import { getAPI } from '/@/utils/axios-utils';
import {SysOrgApi, SysTenantApi} from '/@/api-services/api';
import { SysOrg } from '/@/api-services/models';
import { useUserInfo } from "/@/stores/userInfo";
import { i18n } from '/@/i18n';

const { t } = i18n.global;

const props = defineProps({
	tenantId: Number,
});
const userStore = useUserInfo();
const filterText = ref('');
const treeRef = ref<InstanceType<typeof ElTree>>();
const state = reactive({
	loading: false,
	tenantList: [] as Array<any>,
	tenantId: props.tenantId as number,
	orgData: [] as Array<SysOrg>,
	isShowCheckbox: false,
	ownOrgData: [] as Array<SysOrg>,
});

// SignalR连接
let orgHubConnection: SignalR.HubConnection | null = null;

// 初始化SignalR连接
const initSignalRConnection = () => {
	if (!orgHubConnection) {
		orgHubConnection = new SignalR.HubConnectionBuilder()
			.configureLogging(SignalR.LogLevel.Information)
			.withUrl(`${window.__env__.VITE_API_URL}/hubs/org?token=${getToken()}`, { 
				transport: SignalR.HttpTransportType.WebSockets, 
				skipNegotiation: true 
			})
			.withAutomaticReconnect({ 
				nextRetryDelayInMilliseconds: () => 5000 
			})
			.build();

		orgHubConnection.keepAliveIntervalInMilliseconds = 15 * 1000;
		orgHubConnection.serverTimeoutInMilliseconds = 30 * 60 * 1000;

		// 连接事件
		orgHubConnection.start().then(() => {
			console.log('组织架构SignalR连接已启动');
		}).catch(err => {
			console.error('组织架构SignalR连接失败:', err);
		});

		orgHubConnection.onclose(() => {
			console.log('组织架构SignalR连接已关闭');
		});

		orgHubConnection.onreconnecting(() => {
			ElNotification({
				title: t('message.warning'),
				message: t('org.signalR.reconnecting'),
				type: 'warning',
				position: 'bottom-right',
			});
		});

		orgHubConnection.onreconnected(() => {
			ElNotification({
				title: t('message.success'),
				message: t('org.signalR.reconnected'),
				type: 'success',
				position: 'bottom-right',
			});
		});

		// 组织架构变化事件
		orgHubConnection.on('OrgStructureChanged', (orgId: number) => {
			console.log('组织架构变化，ID:', orgId);
			// 仅刷新变化的节点
			refreshChangedNode(orgId);
		});
	}
};

// 断开SignalR连接
const disconnectSignalR = () => {
	if (orgHubConnection) {
		orgHubConnection.stop().then(() => {
			console.log('组织架构SignalR连接已断开');
			orgHubConnection = null;
		});
	}
};

// 刷新变化的节点
const refreshChangedNode = async (orgId: number) => {
	if (!orgId) return;
	
	try {
		// 获取更新后的节点数据
		const res = await getAPI(SysOrgApi).apiSysOrgListGet(orgId, undefined, undefined, undefined, state.tenantId);
		const updatedNode = res.data.result?.[0];
		
		if (updatedNode) {
			// 查找并更新树中的节点
			const node = findNode(state.orgData, orgId);
			if (node) {
				// 更新节点数据
				Object.assign(node, updatedNode);
				// 重新渲染树
				state.orgData = [...state.orgData];
				ElNotification({
					title: t('message.success'),
					message: t('org.signalR.updated'),
					type: 'success',
					position: 'bottom-right',
				});
			} else {
				// 如果节点不存在，可能是新添加的，重新加载整个树
				initTreeData();
			}
		}
	} catch (error) {
		console.error('刷新组织节点失败:', error);
		ElNotification({
			title: t('message.error'),
			message: t('org.signalR.updateFailed'),
			type: 'error',
			position: 'bottom-right',
		});
	}
};

// 递归查找节点
const findNode = (nodes: Array<SysOrg>, orgId: number): SysOrg | null => {
	for (const node of nodes) {
		if (node.id === orgId) {
			return node;
		}
		if (node.children && node.children.length > 0) {
			const found = findNode(node.children, orgId);
			if (found) {
				return found;
			}
		}
	}
	return null;
};

onMounted( async () => {
	if (userStore.userInfos.accountType == 999) {
		state.tenantList = await getAPI(SysTenantApi).apiSysTenantListGet().then(res => res.data.result ?? []);
	}
	initTreeData();
	// 初始化SignalR连接
	initSignalRConnection();
});

onBeforeUnmount(() => {
	// 断开SignalR连接
	disconnectSignalR();
});

watch(filterText, (val) => {
	treeRef.value!.filter(val);
});
// 检查用户是否有权限访问该组织节点
const hasOrgPermission = (orgId: number): boolean => {
	// 超级管理员或可以查看所有组织的用户拥有所有权限
	if (userStore.userInfos.accountType === 999 || userStore.userInfos.canViewAllOrgs) {
		return true;
	}
	// 检查用户是否有该组织的权限
	return userStore.userInfos.orgPermissions?.includes(orgId) || false;
};

// 过滤没有权限的组织节点
const filterOrgNodes = (nodes: Array<SysOrg>): Array<SysOrg> => {
	return nodes
		.filter(node => hasOrgPermission(node.id))
		.map(node => {
			const filteredNode = { ...node };
			if (node.children && node.children.length > 0) {
				filteredNode.children = filterOrgNodes(node.children);
			}
			return filteredNode;
		});
};

// 初始化树数据
const initTreeData = async () => {
	state.loading = true;
	const res = await getAPI(SysOrgApi).apiSysOrgListGet(0, undefined, undefined, undefined, state.tenantId);
	let orgData = res.data.result ?? [];
	// 根据用户权限过滤组织节点
	orgData = filterOrgNodes(orgData);
	state.orgData = orgData;
	state.loading = false;
};

// 设置默认选择
const setCheckedKeys = (data: any) => {
	const isArray = Array.isArray(data);
	treeRef.value!.setCheckedKeys([]);
	if (!isArray) {
		treeRef.value!.setCurrentNode(data);
		nodeClick(data);
	}
	state.ownOrgData = isArray ? data : [data];
	state.isShowCheckbox = isArray;
};

// 获取已经选择
const getCheckedKeys = () => {
	return treeRef.value!.getCheckedKeys();
};

const filterNode = (value: string, data: any) => {
	if (!value) return true;
	return data.name.includes(value);
};

const handleCommand = async (command: string | number | object) => {
	if ('expandAll' == command) {
		for (let i = 0; i < treeRef.value!.store._getAllNodes().length; i++) {
			treeRef.value!.store._getAllNodes()[i].expanded = true;
		}
	} else if ('collapseAll' == command) {
		for (let i = 0; i < treeRef.value!.store._getAllNodes().length; i++) {
			treeRef.value!.store._getAllNodes()[i].expanded = false;
		}
	} else if ('refresh' == command) {
		initTreeData();
	} else if ('rootNode' == command) {
		emits('node-click', { id: 0, name: '' });
	}
};

// 与父组件的交互逻辑
const emits = defineEmits(['node-click']);
const nodeClick = (node: any) => {
	emits('node-click', node);
};

// 导出对象
defineExpose({ initTreeData, setCheckedKeys, getCheckedKeys });
</script>

<style lang="scss" scoped>
.tree-h-flex {
	display: flex;
}

.tree-h-left {
	flex: 1;
	width: 100%;
}

.tree-h-right {
	width: 42px;
	min-width: 42px;
}
</style>
