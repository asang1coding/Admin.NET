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
				:define-menus="contextMenus"
				@on-contextmenu="handleContextMenu"
				style="background-color: var(--el-bg-color)"
			>
				<template v-slot="{ node }">
					<div class="tree-org-node__text node-label">
						<div class="node-title">{{ node.label }}</div>
						<div class="node-id">编码：<span class="code-highlight">{{ node.id }}</span></div>
					</div>
				</template>
				<template v-slot:expand="{ node }">
					<div>{{ node.children.length }}</div>
				</template>
			</vue3-tree-org>
		</div>
	</div>
</template>

<script lang="ts" setup name="orgTree">
import { onMounted, reactive } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserInfo } from '/@/stores/userInfo';

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
	onlyOneNode: true,
	cloneNodeDrag: false,
	nodeDraggable: true,
	style: {
		background: 'var(--el-color-primary)', //'#FF5C00',
		color: '#FFFFFF',
	},
});

onMounted(async () => {
	state.loading = true;
	var res = await getAPI(SysOrgApi).apiSysOrgListGet(0);
	var d = res.data.result ?? [];
	state.orgData = d[0] ?? []; // 默认第一个树分支
	if (state.orgData.id == userInfos.value.orgId) state.orgData.style = currentNodeStyle;
	else InitOrg(state.orgData.children, userInfos.value.orgId);
	state.loading = false;
});

// 自定义右键菜单类型
interface ContextMenu {
	name: string;
	command: string;
}

// 自定义右键菜单
const contextMenus: ContextMenu[] = [
	{ name: '复制', command: 'copy' }
];

// 右键菜单事件处理
const handleContextMenu = (command: string, node: any) => {
	if (command === 'copy') {
		// 复制节点文本到剪贴板
		navigator.clipboard.writeText(node.label + ' (编码: ' + node.id + ')');
	}
};

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

	.code-highlight {
		background-color: #ffeb3b;
		color: #333;
		padding: 2px 4px;
		border-radius: 2px;
		font-weight: bold;
	}
}
</style>
