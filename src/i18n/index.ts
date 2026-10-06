import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { zhCN, en } from "./translationResources";

/** 管理端壳层（避免 admin.layout 多点路径在部分环境下解析异常） */
const adminLayoutZH = {
  brandFallback: "后台",
  fallbackDisplayName: "当前用户",
  navFloor: "桌台",
  navRecords: "记录",
  navDeposits: "订金",
  navDiners: "食客",
  navPromotion: "推广",
  navCalendar: "日历",
  linkSms: "短信设置",
  linkKitchen: "订单打印",
  linkTables: "桌台管理",
  linkSettings: "系统设置",
  linkUsers: "员工账号",
  todo: "待办",
  pending: "待处理",
  settings: "设置",
  help: "帮助",
  currentUserPrefix: "当前用户：",
  profile: "个人信息",
  changePassword: "修改密码",
  logout: "退出",
  ariaSettings: "设置",
  ariaMenu: "菜单",
  ariaUserMenu: "用户菜单",
  accountLabel: "账号：",
  pwdTitle: "修改密码",
  close: "关闭",
  pwdOld: "原密码",
  pwdNew: "新密码（至少 6 位）",
  pwdConfirm: "确认新密码",
  cancel: "取消",
  save: "保存",
  saving: "保存中…",
  profileTitle: "个人信息",
  fullName: "姓名",
  phone: "手机",
  phoneHint: "输入手机号可启用手机验证码登录",
  email: "邮箱",
  alertPwdMin: "新密码至少 6 位",
  alertPwdMismatch: "两次输入的新密码不一致",
  alertPwdOk: "密码已更新",
  alertPwdFail: "修改密码失败",
  alertProfileOk: "个人信息已更新",
  alertProfileFail: "保存个人信息失败",
} as const;

const adminLayoutEN = {
  brandFallback: "Admin",
  fallbackDisplayName: "User",
  navFloor: "Floor",
  navRecords: "Bookings",
  navDeposits: "Deposits",
  navDiners: "Guests",
  navPromotion: "Promotion",
  navCalendar: "Calendar",
  linkSms: "SMS",
  linkKitchen: "Kitchen print",
  linkTables: "Tables",
  linkSettings: "Settings",
  linkUsers: "Staff",
  todo: "To-do",
  pending: "Pending",
  settings: "Menu",
  help: "Help",
  currentUserPrefix: "Signed in:",
  profile: "Profile",
  changePassword: "Password",
  logout: "Log out",
  ariaSettings: "Settings menu",
  ariaMenu: "Menu",
  ariaUserMenu: "Account menu",
  accountLabel: "Account:",
  pwdTitle: "Change password",
  close: "Close",
  pwdOld: "Current password",
  pwdNew: "New password (min. 6 characters)",
  pwdConfirm: "Confirm new password",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",
  profileTitle: "Profile",
  fullName: "Name",
  phone: "Phone",
  phoneHint: "Add phone to enable SMS login",
  email: "Email",
  alertPwdMin: "New password must be at least 6 characters",
  alertPwdMismatch: "New passwords do not match",
  alertPwdOk: "Password updated",
  alertPwdFail: "Could not change password",
  alertProfileOk: "Profile saved",
  alertProfileFail: "Could not save profile",
} as const;

const resources = {
  "zh-CN": {
    translation: {
      ...zhCN,
      lang: {
        ...zhCN.lang,
        ariaSwitchToEn: "切换到英文界面",
        ariaSwitchToZh: "切换到中文界面",
      },
      errors: {
        ...zhCN.errors,
        generic: "操作失败，请稍后重试",
      },
      adminLayout: adminLayoutZH,
    },
  },
  en: {
    translation: {
      ...en,
      lang: {
        ...en.lang,
        ariaSwitchToEn: "Switch to English",
        ariaSwitchToZh: "Switch to Chinese",
      },
      errors: {
        ...en.errors,
        generic: "Operation failed, please try again later",
      },
      adminLayout: adminLayoutEN,
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "zh-CN",
    fallbackLng: "zh-CN",
    defaultNS: "translation",
    keySeparator: ".",
    nsSeparator: ":",
    interpolation: {
      escapeValue: false,
    },
  });

export type AppLanguage = "zh-CN" | "en";

export default i18n;
export { i18n };
