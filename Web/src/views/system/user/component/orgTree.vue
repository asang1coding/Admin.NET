<template>
	<div v-loading="state.loading">
		<div style="text-align: right; margin-bottom: 10px">
			<div style="margin-right: 10px"><el-switch v-model="state.horizontal"></el-switch> 横向/纵向</div>
			<el-badge :value="wsStatusText" :type="wsStatusType" style="margin-right: 10px">
				<span style="font-size: 12px">WebSocket状态</span>
			</el-badge>
			<el-tooltip content="性能监控信息" placement="top">
				<el-button type="info" size="small" @click="showPerformance">
					<el-icon><Monitor /></el-icon> 性能
				</el-button>
			</el-tooltip>
		</div>
		<div style="height: 500px">
			<vue3-tree-org
	:data="state.orgData"
	:props="{ id: 'id', pid: 'pid', label: 'name', expand: 'expand', children: 'children' }"
	:label-style="state.style"
	:default-expand-level="100"
	:horizontal="state.horizontal"
	:collapsable="state.collapsable"
	:only-one-node="state.onlyOneNode"
	:clone-node-drag="state.cloneNodeDrag"
	:node-draggable="state.nodeDraggable"
	style="background-color: var(--el-bg-color)"
	@node-click="handleNodeClick"
>
				<template v-slot="{ node }">
					<div class="tree-org-node__text node-label">
						<div class="node-title">{{ node.label }}</div>
						<div class="node-id">编码：{{ node.id }}</div>
						<!-- 根据权限显示额外信息 -->
						<div v-if="canShowField('phone') && node.phone" class="node-phone">电话：{{ node.phone }}</div>
						<div v-if="canShowField('email') && node.email" class="node-email">邮箱：{{ node.email }}</div>
					</div>
				</template>
				<template v-slot:expand="{ node }">
					<div>{{ node.children.length }}</div>
				</template>
			</vue3-tree-org>
		</div>

		<!-- 性能监控对话框 -->
<el-dialog v-model="performanceDialogVisible" title="性能监控" width="400px">
	<el-descriptions :column="1" border>
		<el-descriptions-item label="用户信息加载时间">{{ performance.userInfoLoadTime.toFixed(2) }}ms</el-descriptions-item>
		<el-descriptions-item label="WebSocket连接时间">{{ performance.wsConnectionTime.toFixed(2) }}ms</el-descriptions-item>
		<el-descriptions-item label="最后更新时间">{{ formatTime(performance.lastUpdateTime) }}</el-descriptions-item>
		<el-descriptions-item label="WebSocket连接状态">{{ wsStatusText }}</el-descriptions-item>
	</el-descriptions>
</el-dialog>

<!-- 用户列表对话框 -->
<el-dialog v-model="userListDialogVisible" :title="`${selectedOrgName} - 用户列表`" width="800px">
	<!-- 搜索表单 -->
	<el-form :model="state.searchForm" inline style="margin-bottom: 16px">
		<el-form-item label="关键词">
			<el-input
				v-model="state.searchForm.keyword"
				placeholder="请输入姓名或账号"
				clearable
				@keyup.enter="handleSearch"
				style="width: 200px"
			>
			</el-input>
		</el-form-item>
		<el-form-item>
			<el-button type="primary" @click="handleSearch">
				<el-icon><Search /></el-icon> 搜索
			</el-button>
		</el-form-item>
		<el-form-item>
			<el-button @click="handleReset">
				<el-icon><Refresh /></el-icon> 重置
			</el-button>
		</el-form-item>
	</el-form>

	<!-- 用户列表 -->
	<el-table :data="state.userList" border stripe style="width: 100%" v-loading="state.loading">
		<el-table-column prop="userName" label="姓名" min-width="100px" sortable>
			<template #default="scope">
				<span>{{ scope.row.userName }}</span>
			</template>
		</el-table-column>
		<el-table-column prop="account" label="账号" min-width="120px" sortable>
			<template #default="scope">
				<span>{{ scope.row.account }}</span>
			</template>
		</el-table-column>
		<el-table-column prop="email" label="邮箱" min-width="150px">
			<template #default="scope">
				<span>{{ scope.row.email }}</span>
			</template>
		</el-table-column>
		<el-table-column prop="phone" label="电话" min-width="120px">
			<template #default="scope">
				<span>{{ scope.row.phone }}</span>
			</template>
		</el-table-column>
		<el-table-column prop="orgName" label="部门" min-width="150px">
			<template #default="scope">
				<span>{{ scope.row.orgName }}</span>
			</template>
		</el-table-column>
		<el-table-column prop="status" label="状态" min-width="80px">
			<template #default="scope">
				<el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
					{{ scope.row.status === 1 ? '启用' : '禁用' }}
				</el-tag>
			</template>
		</el-table-column>
		<el-table-column label="操作" min-width="120px" fixed="right">
			<template #default="scope">
				<el-button type="primary" link size="small" @click="viewUser(scope.row)">
					查看
				</el-button>
				<el-button type="success" link size="small" @click="editUser(scope.row)">
					编辑
				</el-button>
			</template>
		</el-table-column>
	</el-table>

	<!-- 分页 -->
	<el-pagination
		v-model:current-page="state.pagination.currentPage"
		v-model:page-size="state.pagination.pageSize"
		:page-sizes="[10, 20, 50, 100]"
		:total="state.pagination.total"
		layout="total, sizes, prev, pager, next, jumper"
		@size-change="handlePageChange"
		@current-change="handlePageChange"
		style="margin-top: 16px; text-align: right"
	>
	</el-pagination>
</el-dialog>
	</div>
</template>

<script lang="ts" setup name="orgTree">
import { onMounted, reactive, computed, onUnmounted, h } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserInfo } from '/@/stores/userInfo';
import { Monitor } from '@element-plus/icons-vue';

import { getAPI } from '/@/utils/axios-utils';
import { SysOrgApi, SysUserApi } from '/@/api-services/api';

const stores = useUserInfo();
const { userInfos, wsConnected, performance } = storeToRefs(stores);
const currentNodeStyle = { color: '#FFFFFF', background: '#3B3B3B' };
const state = reactive({
	loading: false,
	orgData: [] as any,
	horizontal: false,
	collapsable: true,
	onlyOneNode: false,
	cloneNodeDrag: false,
	nodeDraggable: false,
	style: {
		background: 'var(--el-color-primary)', //'#FF5C00',
		color: '#FFFFFF',
	},
	selectedOrgId: null as string | null,
	userList: [] as any[],
	searchForm: {
		keyword: '',
	},
	pagination: {
		currentPage: 1,
		pageSize: 10,
		total: 0,
	},
});

// 性能监控对话框
const performanceDialogVisible = reactive({ value: false });
// 用户列表对话框
const userListDialogVisible = reactive({ value: false });
// 查看用户对话框
const viewUserDialogVisible = reactive({ value: false });
// 编辑用户对话框
const editUserDialogVisible = reactive({ value: false });
// 选中的用户
const selectedUser = reactive({} as any);
// 编辑用户表单
const editUserForm = reactive({} as any);
// 表单验证规则
const editUserRules = reactive({} as any);
// 部门名称
const selectedOrgName = computed(() => {
	if (!state.selectedOrgId) return '';
	return findOrgNameById(state.orgData, state.selectedOrgId);
});

// WebSocket状态文本
const wsStatusText = computed(() => {
	return wsConnected.value ? '已连接' : '已断开';
});

// WebSocket状态类型
const wsStatusType = computed(() => {
	return wsConnected.value ? 'success' : 'danger';
});

// 格式化时间
const formatTime = (timestamp: number) => {
	if (!timestamp) return '从未更新';
	const date = new Date(timestamp);
	return date.toLocaleString();
};

// 显示性能监控
const showPerformance = () => {
	performanceDialogVisible.value = true;
};

// 根据权限判断是否显示字段
const canShowField = (fieldName: string) => {
	return stores.canShowField(fieldName);
};

// 处理节点点击事件
const handleNodeClick = async (node: any) => {
	if (!node || !node.id) return;
	state.selectedOrgId = node.id;
	state.pagination.currentPage = 1;
	state.searchForm.keyword = '';
	await loadUserList();
	userListDialogVisible.value = true;
};

// 加载用户列表
const loadUserList = async () => {
	if (!state.selectedOrgId) return;
	state.loading = true;
	try {
		// 根据组织ID获取用户列表
		const res = await getAPI(SysUserApi).apiSysUserListGet({
			orgId: state.selectedOrgId,
			page: state.pagination.currentPage,
			pageSize: state.pagination.pageSize,
			keyword: state.searchForm.keyword,
		});
		state.userList = res.data.result ?? [];
		state.pagination.total = res.data.total ?? 0;
	} catch (error) {
		console.error('获取用户列表失败:', error);
	} finally {
		state.loading = false;
	}
};

// 搜索用户
const handleSearch = () => {
	state.pagination.currentPage = 1;
	loadUserList();
};

// 重置搜索
const handleReset = () => {
	state.searchForm.keyword = '';
	state.pagination.currentPage = 1;
	loadUserList();
};

// 分页变化
const handlePageChange = (page: number, pageSize: number) => {
	state.pagination.currentPage = page;
	state.pagination.pageSize = pageSize;
	loadUserList();
};

// 查看用户信息
const viewUser = (user: any) => {
	selectedUser = user;
	viewUserDialogVisible.value = true;
};

// 编辑用户信息
const editUser = (user: any) => {
	selectedUser = user;
	editUserForm = { ...user };
	editUserDialogVisible.value = true;
};

// 保存用户信息
const saveUser = async () => {
	state.loading = true;
	try {
		// 调用API保存用户信息
		await getAPI(SysUserApi).apiSysUserUpdatePost(editUserForm);
		// 关闭对话框
		editUserDialogVisible.value = false;
		// 刷新用户列表
		loadUserList();
		// 提示成功
		ElMessage.success('用户信息保存成功');
	} catch (error) {
		console.error('保存用户信息失败:', error);
		ElMessage.error('保存用户信息失败');
	} finally {
		state.loading = false;
	}
};

// 根据组织ID查找组织名称
const findOrgNameById = (orgData: any, orgId: string) => {
	if (!orgData || !orgId) return '';
	if (orgData.id === orgId) return orgData.name;
	if (orgData.children && orgData.children.length > 0) {
		for (const child of orgData.children) {
			const name = findOrgNameById(child, orgId);
			if (name) return name;
		}
	}
	return '';
};

// 监听组织数据变化
const handleOrgDataUpdate = (newOrgData: any) => {
	state.orgData = newOrgData;
	// 重新高亮当前用户所在组织
	if (state.orgData.id == userInfos.value.orgId) {
		state.orgData.style = currentNodeStyle;
	} else {
		InitOrg(state.orgData.children, userInfos.value.orgId);
	}
};

// 初始化WebSocket消息监听
const initWebSocketListener = () => {
	// 这里需要根据实际情况修改，假设后端会发送组织数据更新消息
	const ws = new WebSocket(import.meta.env.VITE_API_URL?.replace('http', 'ws') + '/ws/org-data');

	ws.onmessage = (event) => {
		try {
			const updateData = JSON.parse(event.data);
			if (updateData.type === 'orgUpdate') {
				handleOrgDataUpdate(updateData.data);
			}
		} catch (error) {
			console.error('解析组织数据更新消息失败:', error);
		}
	};

	ws.onclose = () => {
		console.log('组织数据WebSocket连接已关闭');
	};

	ws.onerror = (error) => {
		console.error('组织数据WebSocket错误:', error);
	};

	return ws;
};

onMounted(async () => {
	state.loading = true;
	try {
		// 初始化用户信息（包含WebSocket连接）
		await stores.initUserInfo();
		
		// 获取组织数据
		var res = await getAPI(SysOrgApi).apiSysOrgListGet(0);
		var d = res.data.result ?? [];
		state.orgData = d[0] ?? []; // 默认第一个树分支
		if (state.orgData.id == userInfos.value.orgId) state.orgData.style = currentNodeStyle;
		else InitOrg(state.orgData.children, userInfos.value.orgId);
		
		// 启动组织数据WebSocket监听
		const ws = initWebSocketListener();
		
		// 组件卸载时关闭WebSocket
		onUnmounted(() => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.close();
			}
		});
	} catch (error) {
		console.error('初始化组织树失败:', error);
	} finally {
		state.loading = false;
	}
});

// 递归遍历
const InitOrg = (orgData: any, id: any) => {
	if (orgData && orgData.length > 0) {
		orgData.forEach(function (u: any) {
			if (u.id == id) {
				u.style = currentNodeStyle;
				return;
			} else {
				InitOrg(u.children, id);
			}
		});
	}
};
</script>

<style lang="scss" scoped>
.tree-org-node__text {
	// text-align: left;
	font-size: 14px;
	.node-title {
		padding-bottom: 8px;
		margin-bottom: 8px;
		border-bottom: 1px solid currentColor;
	}
	.node-id {
		font-size: 10px;
	}
}
</style>
