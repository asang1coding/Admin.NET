<template>
	<div v-loading="state.loading">
		<div style="text-align: right; margin-bottom: 10px">
			<div style="margin-right: 10px"><el-switch v-model="state.horizontal"></el-switch> 横向/纵向</div>
			<el-button type="primary" @click="saveChanges" :disabled="!state.hasChanges">保存</el-button>
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
				:draggable="state.draggable"
				:define-menus="state.menus"
				@on-contextmenu="handleContextMenu"
				@node-drag-end="handleDragEnd"
				style="background-color: var(--el-bg-color)"
			>
				<template v-slot="{ node }">
					<div class="tree-org-node__text node-label">
						<div class="node-title">{{ node.label }}</div>
						<div class="node-id">编码：<span class="highlight">{{ node.id }}</span></div>
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
import { ElMessage, ElMessageBox } from 'element-plus';

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
	draggable: true, // 允许所有节点拖动
	style: {
		background: 'var(--el-color-primary)', //'#FF5C00',
		color: '#FFFFFF',
	},
	menus: [ // 自定义右键菜单
		{ name: '复制', command: 'copy' },
		{ name: '删除', command: 'delete' }
	],
	hasChanges: false, // 跟踪是否有未保存的更改
	selectedNode: null as any // 存储当前选中的节点
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

// 处理右键菜单
const handleContextMenu = (command: string, node: any) => {
	state.selectedNode = node;
	if (command === 'copy') {
		copyNode();
	} else if (command === 'delete') {
		deleteNode();
	}
};

// 复制节点
const copyNode = () => {
	if (!state.selectedNode) return;
	navigator.clipboard.writeText(state.selectedNode.id.toString())
		.then(() => {
			ElMessage.success('节点编码已复制到剪贴板');
		})
		.catch(err => {
			ElMessage.error('复制失败: ' + err);
		});
};

// 删除节点
const deleteNode = () => {
	if (!state.selectedNode) return;
	
	ElMessageBox.confirm('确定要删除该机构节点吗？', '删除确认', {
		confirmButtonText: '确定',
		cancelButtonText: '取消',
		type: 'warning'
	})
	.then(() => {
		// 这里可以添加实际的删除逻辑
		ElMessage.success('节点已删除');
		state.hasChanges = true; // 标记有未保存的更改
	})
	.catch(() => {
		ElMessage.info('已取消删除');
	});
};

// 处理拖动结束
const handleDragEnd = () => {
	state.hasChanges = true; // 标记有未保存的更改
};

// 保存更改
const saveChanges = () => {
	// 这里可以添加实际的保存逻辑，调用API
	ElMessage.success('更改已保存');
	state.hasChanges = false;
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
	.highlight {
		color: #FF5722;
		font-weight: bold;
	}
}
</style>
