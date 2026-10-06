/**
 * 系统设置页中英成对文案（与 AdminSettingsPage 展示一致）。
 * 动态句使用函数，避免中英文语序问题。
 */

import { useTranslation } from "react-i18next";

export type AdminSettingsCopy = {
  headerTitle: string;
  headerSubtitle: string;
  tabBrand: string;
  tabOperating: string;
  tabActivities: string;
  tabData: string;
  tabLogs: string;
  saveAll: string;
  reload: string;
  saving: string;
  msgOperatingSaved: string;
  msgOnlineSaved: string;
  msgSaved: string;
  msgImageUploaded: string;
  msgPromoImageUploaded: string;
  msgPromoCreated: string;
  msgPromoSaved: string;
  msgPromoDeleted: string;
  msgBackupDone: string;
  msgCleared: string;
  msgBackupPlanSaved: string;
  msgRestored: string;
  msgRestoredUpload: string;
  msgClearedReservations: (res: number, dep: number, backup: string) => string;
  unknownFile: string;
  importStageUpload: string;
  importStageProcess: string;
  operatingTitle: string;
  operatingDesc: string;
  periodEnabled: string;
  moveUp: string;
  moveDown: string;
  delete: string;
  labelDisplayName: string;
  labelIcon: string;
  labelColor: string;
  labelStartTime: string;
  labelEndTime: string;
  addPeriod: string;
  saveOperating: string;
  onlineReservationTitle: string;
  onlineReservationDesc: string;
  enableOnlineBooking: string;
  save: string;
  brandCompanyTitle: string;
  brandCompanyDesc: string;
  labelCompanyName: string;
  labelAppName: string;
  logoSectionTitle: string;
  logoSectionDesc: string;
  logoLabel: string;
  faviconLabel: string;
  currentFile: string;
  loginSectionTitle: string;
  loginSectionDesc: string;
  loginBg: string;
  loginMainTitle: string;
  loginSubTitle: string;
  loginPrimaryColor: string;
  loginAccentColor: string;
  loginCardOpacity: string;
  loginFooter: string;
  loginShowPowered: string;
  splashTitle: string;
  splashDesc: string;
  splashEnable: string;
  splashImage: string;
  splashDuration: string;
  splashCustomer: string;
  splashStaff: string;
  splashHint: string;
  customerHeroTitle: string;
  heroMain: string;
  heroSub: string;
  customerPrimary: string;
  activitiesTitle: string;
  activitiesDesc: string;
  newActivity: string;
  refreshList: string;
  refreshing: string;
  loadingActivities: string;
  noActivities: string;
  sortEnabled: string;
  enabled: string;
  disabled: string;
  edit: string;
  promoName: string;
  promoSort: string;
  promoIntro: string;
  promoGradient: string;
  promoImage: string;
  removeImage: string;
  promoEnableVisible: string;
  saveActivity: string;
  saveChanges: string;
  clearForm: string;
  toneAmber: string;
  toneRose: string;
  toneEmerald: string;
  toneViolet: string;
  backupTitle: string;
  backupDesc: string;
  backupNow: string;
  backingUp: string;
  restoreTitle: string;
  restoreDesc: string;
  refreshBackupList: string;
  selectBackup: string;
  /** 备份下拉中「文件名 + 修改时间」一行展示 */
  backupFileOptionLine: (filename: string, modifiedAt: string) => string;
  noBackupsOption: string;
  restoreFromBackup: string;
  restoring: string;
  uploadDbRestore: string;
  restoreHint: string;
  thBackupFile: string;
  thModified: string;
  thSize: string;
  thActions: string;
  download: string;
  restoreFromThis: string;
  noBackupFiles: string;
  backupPlanTitle: string;
  backupPlanDesc: string;
  loadCurrentPlan: string;
  loading: string;
  enableAutoBackup: string;
  dailyBackupTime: string;
  keepLastN: string;
  lastAutoBackup: string;
  savePlan: string;
  refreshState: string;
  customersImportTitle: string;
  customersImportDesc: string;
  downloadTemplate: string;
  exportData: string;
  dupPhoneSkip: string;
  dupPhoneUpdate: string;
  importCsv: string;
  importing: string;
  reservationsImportTitle: string;
  reservationsImportDesc: string;
  clearBeforeImportTitle: string;
  clearBeforeImportDesc: string;
  labelDateFrom: string;
  labelDateTo: string;
  clearReservationsBtn: string;
  clearing: string;
  dupResSkip: string;
  dupResUpdate: string;
  dangerClearTitle: string;
  dangerClearDesc: string;
  clearBusinessData: string;
  processing: string;
  logsTitle: string;
  logsDesc: string;
  logTabOps: string;
  logTabSms: string;
  logTabAccess: string;
  labelAccount: string;
  labelCategory: string;
  labelAction: string;
  labelTimeFrom: string;
  labelTimeTo: string;
  placeholderAdmin: string;
  placeholderReservation: string;
  placeholderCreate: string;
  placeholderDateTime: string;
  query: string;
  totalCount: (n: number) => string;
  thTime: string;
  thAccount: string;
  thCatAction: string;
  thObject: string;
  thDetail: string;
  thRole: string;
  thPath: string;
  thIp: string;
  thKindPurpose: string;
  thPhone: string;
  thStatus: string;
  thContent: string;
  noData: string;
  pageOf: (p: number) => string;
  prevPage: string;
  nextPage: string;
  smsPhone: string;
  smsKind: string;
  smsPurpose: string;
  smsStatus: string;
  smsPlaceholderFuzzy: string;
  optAll: string;
  optKindReservation: string;
  optKindLogin: string;
  optPurposeSuccess: string;
  optPurposeCancel: string;
  optPurposeStaffLogin: string;
  optStatusSent: string;
  optStatusFailed: string;
  optStatusBlocked: string;
  confirmClearTest: string;
  confirmDeletePromo: string;
  confirmClearReservations: (rangeText: string) => string;
  confirmRestoreSelected: (name: string) => string;
  confirmRestoreUpload: string;
  rangeEarliest: string;
  rangeLatest: string;
  rangeAllTime: string;
  periodLabel: (n: number) => string;
  saveFailed: string;
  loadFailed: string;
  clearFailed: string;
  backupFailed: string;
  restoreFailed: string;
  downloadFailed: string;
  uploadFailed: string;
  importFailed: string;
  importParseFailed: string;
  deleteFailed: string;
  savePromoFailed: string;
  notLoggedIn: string;
  importResult: (c: number, u: number, sk: number, err: number, sample: string) => string;
};

function zhMsgClearedRes(res: number, dep: number, backup: string): string {
  return `已清理预订信息（预订 ${res}，订金 ${dep}），备份文件：${backup}`;
}

function enMsgClearedRes(res: number, dep: number, backup: string): string {
  return `Reservations cleared (${res} reservations, ${dep} deposits). Backup: ${backup}`;
}

function zhImportResult(c: number, u: number, sk: number, err: number, sample: string): string {
  const tail = sample ? `。示例错误：${sample}` : "";
  return `导入完成：新增 ${c}，更新 ${u}，跳过 ${sk}，错误 ${err}${tail}`;
}

function enImportResult(c: number, u: number, sk: number, err: number, sample: string): string {
  const tail = sample ? `. Sample errors: ${sample}` : "";
  return `Import finished: created ${c}, updated ${u}, skipped ${sk}, errors ${err}${tail}`;
}

export const adminSettingsZH: AdminSettingsCopy = {
  headerTitle: "系统与品牌设置",
  headerSubtitle: "Logo、登录页、运营时段、启动页与顾客端展示文案",
  tabBrand: "品牌与登录页",
  tabOperating: "运营时段",
  tabActivities: "门店活动",
  tabData: "数据管理",
  tabLogs: "日志",
  saveAll: "保存全部设置",
  reload: "重新加载",
  saving: "保存中…",
  msgOperatingSaved: "运营时段已保存",
  msgOnlineSaved: "网上预约通道已保存",
  msgSaved: "已保存",
  msgImageUploaded: "图片已上传，请点击底部「保存全部设置」写入数据库",
  msgPromoImageUploaded: "配图已上传，请点击“保存活动”写入数据库",
  msgPromoCreated: "活动已创建",
  msgPromoSaved: "活动已保存",
  msgPromoDeleted: "活动已删除",
  msgBackupDone: "数据库已备份：",
  msgCleared: "已清空业务数据，自动备份文件：",
  msgBackupPlanSaved: "自动备份计划已保存",
  msgRestored: "已恢复数据库（恢复前备份：",
  msgRestoredUpload: "已从上传文件恢复（恢复前备份：",
  msgClearedReservations: zhMsgClearedRes,
  unknownFile: "未知",
  importStageUpload: "正在上传文件…",
  importStageProcess: "文件已上传，服务器处理中…",
  operatingTitle: "运营时段",
  operatingDesc:
    "支持配置 2–8 段时段，且时段不交叉（后台会校验）；用于影响桌台管理页与顾客端可选时刻。",
  periodEnabled: "启用",
  moveUp: "上移",
  moveDown: "下移",
  delete: "删除",
  labelDisplayName: "显示名",
  labelIcon: "图标（短字）",
  labelColor: "颜色",
  labelStartTime: "开始时间",
  labelEndTime: "结束时间",
  addPeriod: "新增时段",
  saveOperating: "保存运营时段",
  onlineReservationTitle: "网上预约通道",
  onlineReservationDesc:
    "开启后：顾客端提交预订后，系统自动分配桌台并确认，随后发送成功预定短信（短信包含桌台信息）。关闭后：拒绝网上预订。",
  enableOnlineBooking: "启用网上预约",
  save: "保存",
  brandCompanyTitle: "企业与产品",
  brandCompanyDesc: "用于浏览器标题、启动页与页脚展示",
  labelCompanyName: "企业全称",
  labelAppName: "产品 / 应用名称",
  logoSectionTitle: "Logo 与站点图标",
  logoSectionDesc: "建议 Logo 透明 PNG；Favicon 可用 .ico / .png",
  logoLabel: "Logo",
  faviconLabel: "Favicon",
  currentFile: "当前：",
  loginSectionTitle: "登录页个性化",
  loginSectionDesc: "背景图、主色与欢迎文案",
  loginBg: "登录页背景图",
  loginMainTitle: "主标题",
  loginSubTitle: "副标题",
  loginPrimaryColor: "主色（背景渐变）",
  loginAccentColor: "强调色（按钮）",
  loginCardOpacity: "登录卡片玻璃层不透明度",
  loginFooter: "页脚文案",
  loginShowPowered: "在登录页展示页脚说明（可与上方文案合并使用）",
  splashTitle: "启动页（Splash）",
  splashDesc: "首次进入会话时全屏展示，可分别控制顾客端与员工入口",
  splashEnable: "启用启动页",
  splashImage: "启动页全屏图（留空则使用品牌渐变）",
  splashDuration: "展示时长（秒）",
  splashCustomer: "顾客端首页等入口显示启动页",
  splashStaff: "员工登录页入口显示启动页",
  splashHint:
    "提示：修改启动页开关后，可清除浏览器会话存储键 rr_splash_* 或新开隐私窗口以立即预览效果。",
  customerHeroTitle: "顾客端首屏文案",
  heroMain: "主标语",
  heroSub: "副标语",
  customerPrimary: "顾客端主按钮/高亮色",
  activitiesTitle: "门店活动",
  activitiesDesc: "维护首页“门店活动”卡片：活动名称、简介与配图。",
  newActivity: "新建活动",
  refreshList: "刷新列表",
  refreshing: "刷新中…",
  loadingActivities: "加载活动中…",
  noActivities: "暂无活动，先从下方创建。",
  sortEnabled: "排序：",
  enabled: "启用",
  disabled: "停用",
  edit: "编辑",
  promoName: "活动名称",
  promoSort: "排序（数字越小越靠前）",
  promoIntro: "简介",
  promoGradient: "渐变风格（用于卡片背景）",
  promoImage: "配图",
  removeImage: "移除配图",
  promoEnableVisible: "启用该活动（前台可见）",
  saveActivity: "保存活动",
  saveChanges: "保存更改",
  clearForm: "清空表单",
  toneAmber: "琥珀暖橘",
  toneRose: "玫瑰红",
  toneEmerald: "翡翠青绿",
  toneViolet: "紫韵绛紫",
  backupTitle: "数据库备份",
  backupDesc:
    "支持一键备份；执行“清空业务数据”前，系统也会自动创建时间戳备份，避免误删无法恢复。",
  backupNow: "一键备份数据库",
  backingUp: "备份中…",
  restoreTitle: "从备份恢复",
  restoreDesc:
    "可从系统已有备份文件恢复，也可上传 .db 文件恢复。恢复前系统会自动再备份一份当前数据库。",
  refreshBackupList: "刷新备份列表",
  selectBackup: "选择备份文件",
  backupFileOptionLine: (filename, modifiedAt) => `${filename}（${modifiedAt}）`,
  noBackupsOption: "暂无备份",
  restoreFromBackup: "从备份恢复",
  restoring: "恢复中…",
  uploadDbRestore: "上传 .db 文件恢复",
  restoreHint: "恢复后建议重启后端服务，确保数据库连接刷新生效。",
  thBackupFile: "备份文件",
  thModified: "修改时间",
  thSize: "大小",
  thActions: "操作",
  download: "下载",
  restoreFromThis: "从该备份恢复",
  noBackupFiles: "暂无备份文件",
  backupPlanTitle: "自动备份计划",
  backupPlanDesc: "每天在指定时间自动备份数据库，并自动清理旧备份，仅保留最近 N 份。",
  loadCurrentPlan: "加载当前计划",
  loading: "加载中…",
  enableAutoBackup: "启用自动备份",
  dailyBackupTime: "每日备份时间",
  keepLastN: "保留最近（份）",
  lastAutoBackup: "最近一次自动备份",
  savePlan: "保存计划",
  refreshState: "刷新状态",
  customersImportTitle: "食客信息导入 / 导出",
  customersImportDesc: "支持下载 CSV 模板、导出现有数据、批量导入（带基础校验与重复数据策略）。",
  downloadTemplate: "下载模板",
  exportData: "导出数据",
  dupPhoneSkip: "重复手机号：跳过",
  dupPhoneUpdate: "重复手机号：覆盖更新",
  importCsv: "导入 CSV",
  importing: "导入中…",
  reservationsImportTitle: "预订记录导入 / 导出",
  reservationsImportDesc:
    "支持 CSV 模板、全量导出与批量导入。导入时会校验日期、时间、人数、手机号与桌台编号有效性。",
  clearBeforeImportTitle: "导入前清理预订信息（自动备份）",
  clearBeforeImportDesc: "可选按日期范围清理，仅删除预订记录与关联订金。留空则清理全部预订数据。",
  labelDateFrom: "开始日期",
  labelDateTo: "结束日期",
  clearReservationsBtn: "一键清理预订信息（自动备份）",
  clearing: "清理中…",
  dupResSkip: "重复预订：跳过",
  dupResUpdate: "重复预订：覆盖更新",
  dangerClearTitle: "清空业务数据",
  dangerClearDesc:
    "一键删除订金、预订、客户档案。系统会在删除前自动备份数据库，管理员账号、品牌配置、桌台布局与上传资源均保留。",
  clearBusinessData: "清空业务数据（自动备份）",
  processing: "处理中…",
  logsTitle: "系统日志",
  logsDesc:
    "操作日志支持按账号/时间/种类筛选；短信日志可按预订/登录验证筛选。访问日志仅主账号 admin 可见，记录各员工在后台打开的页面路径。",
  logTabOps: "操作日志",
  logTabSms: "短信发送日志",
  logTabAccess: "访问日志",
  labelAccount: "账号",
  labelCategory: "种类",
  labelAction: "操作",
  labelTimeFrom: "起始时间",
  labelTimeTo: "结束时间",
  placeholderAdmin: "如：admin",
  placeholderReservation: "如：reservation",
  placeholderCreate: "如：create",
  placeholderDateTime: "YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS",
  query: "查询",
  totalCount: (n: number) => `共 ${n} 条`,
  thTime: "时间",
  thAccount: "账号",
  thCatAction: "种类/操作",
  thObject: "对象",
  thDetail: "详情",
  thRole: "角色",
  thPath: "访问路径",
  thIp: "IP",
  thKindPurpose: "类型/用途",
  thPhone: "号码",
  thStatus: "状态",
  thContent: "内容",
  noData: "暂无数据",
  pageOf: (p: number) => `第 ${p} 页`,
  prevPage: "上一页",
  nextPage: "下一页",
  smsPhone: "收件号码",
  smsKind: "类型",
  smsPurpose: "用途",
  smsStatus: "状态",
  smsPlaceholderFuzzy: "支持模糊搜索",
  optAll: "全部",
  optKindReservation: "预订",
  optKindLogin: "登录验证",
  optPurposeSuccess: "预订成功",
  optPurposeCancel: "预订取消",
  optPurposeStaffLogin: "员工登录",
  optStatusSent: "已发送",
  optStatusFailed: "失败",
  optStatusBlocked: "被拦截",
  confirmClearTest:
    "确定清空业务测试数据吗？\n\n将删除：订金记录、预订记录、客户档案。\n将保留：管理员账号、品牌与登录设置、桌台布局、已上传图片文件。",
  confirmDeletePromo: "确定删除该门店活动吗？删除后无法恢复。",
  confirmClearReservations: (rangeText: string) =>
    `确定清理预订信息吗？\n\n范围：${rangeText}\n将删除：预订记录 + 关联订金记录。\n系统会先自动备份数据库，避免误操作。`,
  confirmRestoreSelected: (name: string) =>
    `确定从备份恢复数据库吗？\n\n将使用备份文件：${name}\n系统会先自动再备份一份当前数据库。\n恢复完成后建议重启后端服务以确保生效。`,
  confirmRestoreUpload:
    "确定从上传文件恢复数据库吗？\n\n系统会先自动备份当前数据库。\n恢复完成后建议重启后端服务以确保生效。",
  rangeEarliest: "最早",
  rangeLatest: "最晚",
  rangeAllTime: "全部时间",
  periodLabel: (n: number) => `时段${n}`,
  saveFailed: "保存失败",
  loadFailed: "加载失败",
  clearFailed: "清空失败",
  backupFailed: "备份失败",
  restoreFailed: "恢复失败",
  downloadFailed: "下载失败",
  uploadFailed: "上传失败",
  importFailed: "导入失败",
  importParseFailed: "导入响应解析失败",
  deleteFailed: "删除失败",
  savePromoFailed: "保存活动失败",
  notLoggedIn: "未登录",
  importResult: zhImportResult,
};

export const adminSettingsEN: AdminSettingsCopy = {
  headerTitle: "System & branding",
  headerSubtitle: "Logo, login page, operating hours, splash, and customer-facing copy",
  tabBrand: "Brand & login",
  tabOperating: "Operating hours",
  tabActivities: "Promotions",
  tabData: "Data",
  tabLogs: "Logs",
  saveAll: "Save all settings",
  reload: "Reload",
  saving: "Saving…",
  msgOperatingSaved: "Operating hours saved",
  msgOnlineSaved: "Online booking channel saved",
  msgSaved: "Saved",
  msgImageUploaded: "Image uploaded — click “Save all settings” at the bottom to persist",
  msgPromoImageUploaded: "Image uploaded — click “Save promotion” to persist",
  msgPromoCreated: "Promotion created",
  msgPromoSaved: "Promotion saved",
  msgPromoDeleted: "Promotion deleted",
  msgBackupDone: "Database backed up:",
  msgCleared: "Business data cleared. Backup file:",
  msgBackupPlanSaved: "Automatic backup plan saved",
  msgRestored: "Database restored (pre-restore backup:",
  msgRestoredUpload: "Restored from upload (pre-restore backup:",
  msgClearedReservations: enMsgClearedRes,
  unknownFile: "unknown",
  importStageUpload: "Uploading file…",
  importStageProcess: "Upload complete — processing on server…",
  operatingTitle: "Operating hours",
  operatingDesc:
    "Configure 2–8 non-overlapping periods (validated server-side); used for floor view and customer time slots.",
  periodEnabled: "Enabled",
  moveUp: "Move up",
  moveDown: "Move down",
  delete: "Delete",
  labelDisplayName: "Display name",
  labelIcon: "Icon (short)",
  labelColor: "Color",
  labelStartTime: "Start",
  labelEndTime: "End",
  addPeriod: "Add period",
  saveOperating: "Save operating hours",
  onlineReservationTitle: "Online booking",
  onlineReservationDesc:
    "When on: after a guest submits a booking, the system assigns tables, confirms, and sends SMS with table info. When off: online booking is rejected.",
  enableOnlineBooking: "Enable online booking",
  save: "Save",
  brandCompanyTitle: "Company & product",
  brandCompanyDesc: "Shown in browser title, splash, and footer",
  labelCompanyName: "Company name",
  labelAppName: "Product / app name",
  logoSectionTitle: "Logo & favicon",
  logoSectionDesc: "Logo: transparent PNG recommended; favicon: .ico / .png",
  logoLabel: "Logo",
  faviconLabel: "Favicon",
  currentFile: "Current:",
  loginSectionTitle: "Login page",
  loginSectionDesc: "Background, colors, and welcome text",
  loginBg: "Login background",
  loginMainTitle: "Main title",
  loginSubTitle: "Subtitle",
  loginPrimaryColor: "Primary (gradient)",
  loginAccentColor: "Accent (buttons)",
  loginCardOpacity: "Login card glass opacity",
  loginFooter: "Footer text",
  loginShowPowered: "Show footer note on login (can combine with text above)",
  splashTitle: "Splash screen",
  splashDesc: "Full-screen first visit; control separately for guests and staff",
  splashEnable: "Enable splash",
  splashImage: "Splash image (empty = brand gradient)",
  splashDuration: "Duration (seconds)",
  splashCustomer: "Show splash for customer entry",
  splashStaff: "Show splash for staff login entry",
  splashHint:
    "Tip: after toggling splash, clear session keys rr_splash_* or use a private window to preview.",
  customerHeroTitle: "Customer home hero",
  heroMain: "Headline",
  heroSub: "Subhead",
  customerPrimary: "Customer primary / accent",
  activitiesTitle: "Promotions",
  activitiesDesc: "Home “Promotions” cards: title, blurb, and image.",
  newActivity: "New promotion",
  refreshList: "Refresh list",
  refreshing: "Refreshing…",
  loadingActivities: "Loading promotions…",
  noActivities: "No promotions yet — create one below.",
  sortEnabled: "Sort:",
  enabled: "On",
  disabled: "Off",
  edit: "Edit",
  promoName: "Title",
  promoSort: "Sort order (smaller first)",
  promoIntro: "Description",
  promoGradient: "Gradient style (card background)",
  promoImage: "Image",
  removeImage: "Remove image",
  promoEnableVisible: "Enable (visible on site)",
  saveActivity: "Save promotion",
  saveChanges: "Save changes",
  clearForm: "Clear form",
  toneAmber: "Amber orange",
  toneRose: "Rose red",
  toneEmerald: "Emerald teal",
  toneViolet: "Violet purple",
  backupTitle: "Database backup",
  backupDesc:
    "One-click backup; clearing business data also creates a timestamped backup first.",
  backupNow: "Backup database now",
  backingUp: "Backing up…",
  restoreTitle: "Restore from backup",
  restoreDesc:
    "Restore from an existing backup file or upload a .db file. The current DB is backed up before restore.",
  refreshBackupList: "Refresh backup list",
  selectBackup: "Backup file",
  backupFileOptionLine: (filename, modifiedAt) => `${filename} (${modifiedAt})`,
  noBackupsOption: "No backups",
  restoreFromBackup: "Restore from backup",
  restoring: "Restoring…",
  uploadDbRestore: "Upload .db to restore",
  restoreHint: "After restore, restart the API server so connections refresh.",
  thBackupFile: "File",
  thModified: "Modified",
  thSize: "Size",
  thActions: "Actions",
  download: "Download",
  restoreFromThis: "Restore from this",
  noBackupFiles: "No backup files",
  backupPlanTitle: "Automatic backup plan",
  backupPlanDesc: "Back up daily at the set time; keep only the last N backups.",
  loadCurrentPlan: "Load current plan",
  loading: "Loading…",
  enableAutoBackup: "Enable automatic backup",
  dailyBackupTime: "Daily time",
  keepLastN: "Keep last (count)",
  lastAutoBackup: "Last auto backup",
  savePlan: "Save plan",
  refreshState: "Refresh status",
  customersImportTitle: "Customer import / export",
  customersImportDesc: "CSV template, export, and import with validation and duplicate rules.",
  downloadTemplate: "Download template",
  exportData: "Export",
  dupPhoneSkip: "Duplicate phone: skip",
  dupPhoneUpdate: "Duplicate phone: overwrite",
  importCsv: "Import CSV",
  importing: "Importing…",
  reservationsImportTitle: "Reservation import / export",
  reservationsImportDesc:
    "CSV template, full export, and import with date/time/party/phone/table validation.",
  clearBeforeImportTitle: "Clear reservations before import (auto backup)",
  clearBeforeImportDesc:
    "Optional date range; deletes reservations and linked deposits only. Empty = all reservations.",
  labelDateFrom: "From date",
  labelDateTo: "To date",
  clearReservationsBtn: "Clear reservations (auto backup)",
  clearing: "Clearing…",
  dupResSkip: "Duplicate booking: skip",
  dupResUpdate: "Duplicate booking: overwrite",
  dangerClearTitle: "Clear business data",
  dangerClearDesc:
    "Deletes deposits, reservations, and customer profiles. A backup is taken first. Admin accounts, branding, floor layout, and uploads are kept.",
  clearBusinessData: "Clear business data (auto backup)",
  processing: "Working…",
  logsTitle: "System logs",
  logsDesc:
    "Operations: filter by account/time/category. SMS: booking vs login OTP. Access logs (primary admin only): staff page visits in the admin UI.",
  logTabOps: "Operations",
  logTabSms: "SMS",
  logTabAccess: "Access",
  labelAccount: "Account",
  labelCategory: "Category",
  labelAction: "Action",
  labelTimeFrom: "From",
  labelTimeTo: "To",
  placeholderAdmin: "e.g. admin",
  placeholderReservation: "e.g. reservation",
  placeholderCreate: "e.g. create",
  placeholderDateTime: "YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
  query: "Search",
  totalCount: (n: number) => `${n} total`,
  thTime: "Time",
  thAccount: "Account",
  thCatAction: "Category / action",
  thObject: "Object",
  thDetail: "Detail",
  thRole: "Role",
  thPath: "Path",
  thIp: "IP",
  thKindPurpose: "Kind / purpose",
  thPhone: "Phone",
  thStatus: "Status",
  thContent: "Content",
  noData: "No data",
  pageOf: (p: number) => `Page ${p}`,
  prevPage: "Previous",
  nextPage: "Next",
  smsPhone: "Recipient",
  smsKind: "Kind",
  smsPurpose: "Purpose",
  smsStatus: "Status",
  smsPlaceholderFuzzy: "Fuzzy search supported",
  optAll: "All",
  optKindReservation: "Reservation",
  optKindLogin: "Login OTP",
  optPurposeSuccess: "Booking success",
  optPurposeCancel: "Booking cancel",
  optPurposeStaffLogin: "Staff login",
  optStatusSent: "Sent",
  optStatusFailed: "Failed",
  optStatusBlocked: "Blocked",
  confirmClearTest:
    "Clear all business test data?\n\nDeletes: deposits, reservations, customer profiles.\nKeeps: admin accounts, branding, floor layout, uploaded images.",
  confirmDeletePromo: "Delete this promotion? This cannot be undone.",
  confirmClearReservations: (rangeText: string) =>
    `Clear reservation data?\n\nRange: ${rangeText}\nDeletes reservations and linked deposits.\nA database backup is created first.`,
  confirmRestoreSelected: (name: string) =>
    `Restore database from backup?\n\nFile: ${name}\nThe current database will be backed up first.\nRestart the API after restore.`,
  confirmRestoreUpload:
    "Restore database from uploaded file?\n\nThe current database will be backed up first.\nRestart the API after restore.",
  rangeEarliest: "earliest",
  rangeLatest: "latest",
  rangeAllTime: "all time",
  periodLabel: (n: number) => `Period ${n}`,
  saveFailed: "Save failed",
  loadFailed: "Load failed",
  clearFailed: "Clear failed",
  backupFailed: "Backup failed",
  restoreFailed: "Restore failed",
  downloadFailed: "Download failed",
  uploadFailed: "Upload failed",
  importFailed: "Import failed",
  importParseFailed: "Could not parse import response",
  deleteFailed: "Delete failed",
  savePromoFailed: "Save promotion failed",
  notLoggedIn: "Not signed in",
  importResult: enImportResult,
};

export function useAdminSettingsCopy(): AdminSettingsCopy {
  const { i18n } = useTranslation();
  return i18n.language === "en" ? adminSettingsEN : adminSettingsZH;
}
