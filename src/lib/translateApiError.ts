import type { TFunction } from "i18next";
import { i18n } from "@/i18n";

/** 将后端返回的中文错误转为当前语言；zh-CN 时保持原文（与后端一致）。 */
export function translateApiError(t: TFunction, message: string): string {
  const m = (message || "").trim();
  if (!m) return t("errors.generic");
  if (i18n.language === "zh-CN") return m;

  const key = API_ZH_TO_KEY[m];
  if (key) return t(key);

  const tableLock = /^桌台已被 (.+) 锁定$/.exec(m);
  if (tableLock) return t("apiErrors.tableLockedBy", { name: tableLock[1] });
  const tableLockFloor = /^桌台已被 (.+) 锁定，您无权操作$/.exec(m);
  if (tableLockFloor) return t("apiErrors.tableLockedNoAccess", { name: tableLockFloor[1] });
  const noTable = /^桌台编号不存在：(.+)$/.exec(m);
  if (noTable) return t("apiErrors.tableCodeMissing", { code: noTable[1] });
  const rate = /^发送过于频繁，请 (\d+) 秒后再试$/.exec(m);
  if (rate) return t("apiErrors.smsRateLimit", { seconds: rate[1] });
  const rowInt = /^第 (\d+) 行字段 (.+) 需为整数$/.exec(m);
  if (rowInt) return t("apiErrors.csvRowMustInt", { line: rowInt[1], field: rowInt[2] });
  const delRef = /^仍有 (\d+) 条预订关联此餐位/.exec(m);
  if (delRef) return t("apiErrors.tableDeleteRef", { count: delRef[1] });
  const smsGw = /^短信网关调用异常：(.+)$/.exec(m);
  if (smsGw) return t("apiErrors.smsGateway", { detail: smsGw[1] });
  const fileBig = /^文件过大（上限 (\d+)MB）$/.exec(m);
  if (fileBig) return t("apiErrors.fileTooLarge", { mb: fileBig[1] });

  return m;
}

/** 与后端 detail 完全一致的中文 -> 翻译 key（含中文逗号等字符的键必须加引号） */
const API_ZH_TO_KEY: Record<string, string> = {
  未登录: "apiErrors.notLoggedIn",
  未登录或令牌无效: "apiErrors.invalidToken",
  用户不存在: "apiErrors.userMissing",
  需要超级管理员权限: "apiErrors.needSuperAdmin",
  需要员工权限: "apiErrors.needStaff",
  用户名或密码错误: "apiErrors.badCredentials",
  手机号未绑定员工账号: "apiErrors.phoneNotBound",
  验证码错误或已过期: "apiErrors.badOtp",
  短信功能未启用: "apiErrors.smsDisabled",
  短信配置不完整: "apiErrors.smsIncomplete",
  "短信发送失败，请稍后重试": "apiErrors.smsSendFailed",
  手机号格式不正确: "apiErrors.badPhone",
  原密码不正确: "apiErrors.wrongOldPassword",
  该手机号已存在: "apiErrors.phoneExists",
  客户不存在: "apiErrors.customerMissing",
  关联预订不存在: "apiErrors.reservationMissingForDeposit",
  订金记录不存在: "apiErrors.depositMissing",
  预订不存在: "apiErrors.bookingMissing",
  当前状态不可补发成功短信: "apiErrors.resendSmsNotAllowed",
  桌台编号已存在: "apiErrors.tableCodeExists",
  桌台不存在: "apiErrors.tableMissing",
  仅超级管理员可修改桌台平面布局: "apiErrors.layoutAdminOnly",
  用户名已存在: "apiErrors.usernameExists",
  不能将最后一个超级管理员降为预订管理员: "apiErrors.cannotDemoteLastAdmin",
  不能删除当前登录账号: "apiErrors.cannotDeleteSelf",
  不能删除最后一个超级管理员: "apiErrors.cannotDeleteLastAdmin",
  网上预约通道已关闭: "apiErrors.onlineBookingClosed",
  预订时间不能早于当前时间: "apiErrors.reservationPastPublic",
  "不可保存为早于当前超过一天的预订时间。如需补录更早记录，请将状态选为「已离席」。":
    "apiErrors.reservationPastAdmin",
  "不可保存为过去时间的预订。如需补录已离席记录，请将状态选为「已离席」。":
    "apiErrors.reservationPastAdmin",
  "日期格式须为 YYYY-MM-DD": "apiErrors.dateFormatYmd",
  "无法完成交换：请确认日期、时段正确，且至少有一侧存在有效预订。": "apiErrors.swapFailed",
  人数超过该桌台容量: "apiErrors.overCapacity",
  该桌台已有散客入席: "apiErrors.walkinExists",
  "该桌台在未来限制时段内已有预订，不可安排散客入席": "apiErrors.walkinBlocked",
  该桌台当前无散客入席: "apiErrors.noWalkin",
  "请先配置 sp_id 与接口密码（或环境变量）": "apiErrors.smsSpMissing",
  不支持的资源类型: "apiErrors.badUploadKind",
  仅支持常见图片格式: "apiErrors.imagesOnly",
  活动不存在: "apiErrors.promotionMissing",
  "数据库文件不存在，无法备份": "apiErrors.dbMissingForBackup",
  备份文件不存在: "apiErrors.backupMissing",
  "仅支持 .db 文件": "apiErrors.dbOnly",
  不能用当前数据库自身进行恢复: "apiErrors.cannotRestoreSelf",
  "CSV 编码需为 UTF-8": "apiErrors.csvUtf8",
  "CSV 缺少表头": "apiErrors.csvNoHeader",
  "开始日期格式应为 YYYY-MM-DD": "apiErrors.dateFromFormat",
  "结束日期格式应为 YYYY-MM-DD": "apiErrors.dateToFormat",
  开始日期不能晚于结束日期: "apiErrors.dateRangeOrder",
  文件名不合法: "apiErrors.badFilename",
  "请上传 .db 文件": "apiErrors.uploadDb",
  "文件过小，疑似无效数据库": "apiErrors.dbTooSmall",
  "时间格式应为 HH:MM": "apiErrors.timeFormat",
  时间不合法: "apiErrors.timeInvalid",
  "成功短信模板不要填写签名，系统会自动加上【音昱上海】": "apiErrors.smsTplSuccessNoSig",
  "取消短信模板不要填写签名，系统会自动加上【音昱上海】": "apiErrors.smsTplCancelNoSig",
};
