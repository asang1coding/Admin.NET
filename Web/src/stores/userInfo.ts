import { defineStore } from 'pinia';
import { Local, Session } from '/@/utils/storage';
import Watermark from '/@/utils/watermark';
import { useThemeConfig } from '/@/stores/themeConfig';
import { i18n } from "/@/i18n";
import localforage from 'localforage';

import { getAPI } from '/@/utils/axios-utils';
import { SysAuthApi, SysConstApi, SysDictTypeApi } from '/@/api-services/api';

const { t } = i18n.global;

// 初始化IndexedDB
localforage.config({
  name: 'adminNetDB',
  version: 1.0,
  storeName: 'userInfoStore',
  description: '存储用户信息数据'
});

/**
 * 用户信息
 * @methods setUserInfos 设置用户信息
 */
export const useUserInfo = defineStore('userInfo', {
	state: (): UserInfosState => ({
		userInfos: {} as any,
		constList: [] as any,
		dictList: {} as any,
		// WebSocket状态
		wsConnected: false,
		wsConnectionAttempts: 0,
		maxWsAttempts: 5,
		wsReconnectInterval: 3000,
		// 性能监控
		performance: {
			userInfoLoadTime: 0,
			wsConnectionTime: 0,
			lastUpdateTime: 0
		},
		// 轮询状态
		pollingInterval: null,
		isPolling: false
	}),
	getters: {
		// // 获取系统常量列表
		// async getSysConstList(): Promise<any[]> {
		// 	var res = await getAPI(SysConstApi).apiSysConstListGet();
		// 	this.constList = res.data.result ?? [];
		// 	return this.constList;
		// },
	},
	actions: {
		// 初始化用户信息
		async initUserInfo() {
			const startTime = performance.now();
			try {
				// 优先从IndexedDB恢复
				const dbUserInfo = await localforage.getItem('userInfo');
				if (dbUserInfo) {
					this.userInfos = dbUserInfo;
				} else {
					// 从Session或API获取
					this.userInfos = Session.get('userInfo') ?? <UserInfos>await this.getApiUserInfo();
					// 保存到IndexedDB
					await localforage.setItem('userInfo', this.userInfos);
				}
				// 记录加载时间
				this.performance.userInfoLoadTime = performance.now() - startTime;
				// 启动WebSocket连接
				this.startWebSocket();
			} catch (error) {
				console.error('初始化用户信息失败:', error);
				// 失败时从API获取
				this.userInfos = await this.getApiUserInfo();
				this.performance.userInfoLoadTime = performance.now() - startTime;
			}
		},

		// 存储用户信息到浏览器缓存
		async setUserInfos() {
			this.userInfos = Session.get('userInfo') ?? <UserInfos>await this.getApiUserInfo();
			// 保存到IndexedDB
			await localforage.setItem('userInfo', this.userInfos);
		},

		// 存储常量信息到浏览器缓存
		async setConstList() {
			this.constList = Session.get('constList') ?? <any[]>await this.getSysConstList();
			if (!Session.get('constList')) Session.set('constList', this.constList);
		},

		// 存储字典信息到浏览器缓存
		async setDictList() {
			var dictList = await getAPI(SysDictTypeApi).apiSysDictTypeAllDictListGet().then(res => res.data.result ?? {});
			var dictListTemp = JSON.parse(JSON.stringify(dictList));

			await Promise.all(Object.keys(dictList).map(async (key) => {
				dictList[key].forEach((da: any, index: any) => {
					setDictLangMessageAsync(dictListTemp[key][index]);
				});
				// 如果 key 以 "Enum" 结尾，则转换 value 为数字
				if (key.endsWith("Enum")) {
					dictListTemp[key].forEach((e: any) => e.value = Number(e.value));
				}
			}))
			this.dictList = dictListTemp;
		},

		// 获取当前用户信息
		getApiUserInfo() {
			return new Promise((resolve) => {
				getAPI(SysAuthApi)
					.apiSysAuthUserInfoGet()
					.then(async (res: any) => {
						if (res.data.result == null) return;
						var d = res.data.result;
						const userInfos = {
							id: d.id,
							account: d.account,
							realName: d.realName,
							phone: d.phone,
							idCardNum: d.idCardNum,
							email: d.email,
							accountType: d.accountType,
							avatar: d.avatar ?? '/upload/logo.png',
							address: d.address,
							signature: d.signature,
							orgId: d.orgId,
							orgName: d.orgName,
							posName: d.posName,
							roles: d.roleIds,
							authBtnList: d.buttons,
							tenantId: d.tenantId,
							time: new Date().getTime(),
							updateTime: new Date().getTime()
						};

						// 用户水印
						const storesThemeConfig = useThemeConfig();
						storesThemeConfig.themeConfig.watermarkText = d.watermarkText ?? '';
						if (storesThemeConfig.themeConfig.isWatermark) Watermark.set(storesThemeConfig.themeConfig.watermarkText);
						else Watermark.del();

						Local.remove('themeConfig');
						Local.set('themeConfig', storesThemeConfig.themeConfig);

						resolve(userInfos);
					});
			});
		},

		// 获取常量集合
		getSysConstList() {
			return new Promise((resolve) => {
				getAPI(SysConstApi)
					.apiSysConstListGet()
					.then(async (res: any) => {
						resolve(res.data.result ?? []);
					});
			});
		},

		// 根据常量类名获取常量数据
		getConstDataByTypeCode(typeCode: string) {
			return this.constList.find((item: any) => item.code === typeCode)?.data?.result || [];
		},

		// 根据常量类名和编码获取常量值
		getConstItemNameByType(typeCode: string, itemCode: string) {
			const data = this.getConstDataByTypeCode(typeCode);
			return data.find((item: any) => item.code === itemCode)?.name;
		},

		// 根据字典类型获取字典数据
		getDictDataByCode(dictTypeCode: string) {
			return this.dictList[dictTypeCode] || [];
		},

		// 启动WebSocket连接
		startWebSocket() {
			if (this.wsConnected) return;

			const wsUrl = import.meta.env.VITE_API_URL?.replace('http', 'ws') + '/ws/user-info';
			const ws = new WebSocket(wsUrl);
			const startTime = performance.now();

			ws.onopen = () => {
				console.log('WebSocket连接已建立');
				this.wsConnected = true;
				this.wsConnectionAttempts = 0;
				this.performance.wsConnectionTime = performance.now() - startTime;
				this.performance.lastUpdateTime = Date.now();
			};

			ws.onmessage = (event) => {
				try {
					const updateData = JSON.parse(event.data);
					// 增量更新用户信息
					this.incrementalUpdateUserInfo(updateData);
					this.performance.lastUpdateTime = Date.now();
				} catch (error) {
					console.error('解析WebSocket消息失败:', error);
				}
			};

			ws.onerror = (error) => {
				console.error('WebSocket错误:', error);
				this.handleWsError();
			};

			ws.onclose = () => {
				console.log('WebSocket连接已关闭');
				this.wsConnected = false;
				this.handleWsError();
			};

			this.ws = ws;
		},

		// 处理WebSocket错误
		handleWsError() {
			this.wsConnectionAttempts++;

			if (this.wsConnectionAttempts <= this.maxWsAttempts) {
				// 尝试重连
				setTimeout(() => {
					console.log(`尝试重新连接WebSocket... (${this.wsConnectionAttempts}/${this.maxWsAttempts})`);
					this.startWebSocket();
				}, this.wsReconnectInterval * Math.pow(2, this.wsConnectionAttempts - 1)); // 指数退避
			} else {
				// 切换到轮询模式
				console.log('WebSocket重连失败，切换到轮询模式');
				this.startPolling();
			}
		},

		// 启动轮询
		startPolling() {
			if (this.isPolling) return;

			this.isPolling = true;
			this.pollingInterval = setInterval(async () => {
				try {
					const latestUserInfo = await this.getApiUserInfo();
					this.incrementalUpdateUserInfo(latestUserInfo);
				} catch (error) {
					console.error('轮询获取用户信息失败:', error);
				}
			}, 30000); // 每30秒轮询一次
		},

		// 停止轮询
		stopPolling() {
			if (this.pollingInterval) {
				clearInterval(this.pollingInterval);
				this.pollingInterval = null;
				this.isPolling = false;
			}
		},

		// 增量更新用户信息
		incrementalUpdateUserInfo(newData: Partial<UserInfos>) {
			if (!newData || !this.userInfos.id) return;

			// 仅更新变化的字段
			Object.keys(newData).forEach(key => {
				const typedKey = key as keyof UserInfos;
				if (this.userInfos[typedKey] !== newData[typedKey]) {
					this.userInfos[typedKey] = newData[typedKey];
				}
			});

			// 保存到缓存和IndexedDB
			Session.set('userInfo', this.userInfos);
			localforage.setItem('userInfo', this.userInfos);

			// 更新水印
			if (newData.watermarkText) {
				const storesThemeConfig = useThemeConfig();
				storesThemeConfig.themeConfig.watermarkText = newData.watermarkText;
				if (storesThemeConfig.themeConfig.isWatermark) Watermark.set(storesThemeConfig.themeConfig.watermarkText);
				Local.set('themeConfig', storesThemeConfig.themeConfig);
			}
		},

		// 根据权限判断是否显示字段
		canShowField(fieldName: string): boolean {
			// 示例权限控制逻辑，根据实际需求修改
			const restrictedFields: { [key: string]: string[] } = {
				idCardNum: ['admin', 'superadmin'],
				phone: ['admin', 'superadmin', 'manager'],
				email: ['admin', 'superadmin', 'manager', 'user']
			};

			if (!restrictedFields[fieldName]) return true;
			if (!this.userInfos.roles || this.userInfos.roles.length === 0) return false;

			return this.userInfos.roles.some(role => restrictedFields[fieldName].includes(role));
		},
	},
});

// 处理字典国际化, 默认显示字典中的label值
const setDictLangMessageAsync = async (dict: any) => {
	dict.langMessage = `message.dictType.${dict.typeCode}_${dict.value}`;
	const text = t(dict.langMessage);
	dict.label = text !== dict.langMessage ? text : dict.label;
}