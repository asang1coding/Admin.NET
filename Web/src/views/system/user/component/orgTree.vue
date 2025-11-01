<template>
	<div v-loading="state.loading">
		<div style="text-align: right">
			<div style="margin-right: 10px"><el-switch v-model="state.horizontal"></el-switch> 横向/纵向</div>
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
			>
				<template v-slot="{ node }">
					<div class="tree-org-node__text node-label" @contextmenu.prevent="(event) => openMenu(event, node)">
						<div class="node-title">{{ node.label }}</div>
						<div class="node-id">编码：<span class="code-highlight">{{ node.id }}</span></div>
					</div>
				</template>
				<template v-slot:expand="{ node }">
					<div>{{ node.children.length }}</div>
				</template>
			</vue3-tree-org>
		</div>
		
		<!-- 右键菜单 -->
		<el-dropdown v-if="state.showMenu" class="context-menu" :style="{ top: state.menuTop + 'px', left: state.menuLeft + 'px' }" trigger="manual" v-model:visible="state.showMenu">
			<el-dropdown-menu>
				<el-dropdown-item @click="copyText">复制文本</el-dropdown-item>
			</el-dropdown-menu>
		</el-dropdown>
	</div>
</template>

<script lang="ts" setup name="orgTree">
import { onMounted, reactive, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserInfo } from '/@/stores/userInfo';
import { ElMessage } from 'element-plus';

import { getAPI } from '/@/utils/axios-utils';
import { SysOrgApi } from '/@/api-services/api';

const stores = useUserInfo();
const { userInfos } = storeToRefs(stores);
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
	// 右键菜单
	showMenu: false,
	menuTop: 0,
	menuLeft: 0,
	selectedNode: null as any,
});

onMounted(async () => {
	state.loading = true;
	var res = await getAPI(SysOrgApi).apiSysOrgListGet(0);
	var d = res.data.result ?? [];
	state.orgData = d[0] ?? []; // 默认第一个树分支
	if (state.orgData.id == userInfos.value.orgId) state.orgData.style = currentNodeStyle;
	else InitOrg(state.orgData.children, userInfos.value.orgId);
	state.loading = false;
	
	// 点击页面其他地方关闭菜单
	document.addEventListener('click', closeMenu);
});

onBeforeUnmount(() => {
	document.removeEventListener('click', closeMenu);
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

// 打开右键菜单
const openMenu = (event: PointerEvent, node: any) => {
	state.showMenu = true;
	state.menuTop = event.clientY;
	state.menuLeft = event.clientX;
	state.selectedNode = node;
};

// 关闭右键菜单
const closeMenu = () => {
	state.showMenu = false;
};

// 复制文本
const copyText = async () => {
	try {
		const textToCopy = `名称: ${state.selectedNode.label}\n编码: ${state.selectedNode.id}`;
		await navigator.clipboard.writeText(textToCopy);
		ElMessage.success('文本已复制到剪贴板');
	} catch (error) {
		ElMessage.error('复制失败，请手动复制');
	} finally {
		closeMenu();
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

// 右键菜单样式
.context-menu {
	position: fixed;
	z-index: 10000;
	background-color: #fff;
	border: 1px solid #e4e7ed;
	border-radius: 4px;
	box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
	padding: 5px 0;
	min-width: 100px;
}

.context-menu .el-dropdown-menu {
	border: none;
	box-shadow: none;
	padding: 0;
}

.context-menu .el-dropdown-item {
	padding: 8px 16px;
	cursor: pointer;
	transition: background-color 0.2s;
}

.context-menu .el-dropdown-item:hover {
	background-color: #f5f7fa;
}

// 编码高亮样式
.code-highlight {
	background-color: #ffff00;
	color: #000000;
	font-weight: bold;
	padding: 2px 4px;
	border-radius: 2px;
}
</style>
