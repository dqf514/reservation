import { useMemo, useState } from "react";

type ManualSection = {
  id: string;
  title: string;
  permission: "all" | "admin";
  summary: string;
  bullets: string[];
  keywords: string[];
};

const SECTIONS: ManualSection[] = [
  {
    id: "overview",
    title: "系统概览",
    permission: "all",
    summary: "本系统用于餐厅预订、订金、食客档案、桌台与运营设置的统一管理。",
    bullets: [
      "主业务入口：桌台、记录、订金、食客、日历、待办、订单打印。",
      "数据管理支持：导入导出、导入前清理、数据库备份、从备份恢复。",
      "所有时间按服务器本地时间记录与展示。",
      "核心业务状态：waiting/confirmed/arrived/left/cancelled。",
    ],
    keywords: ["系统", "概览", "模块", "状态", "本地时间"],
  },
  {
    id: "roles",
    title: "角色与权限",
    permission: "all",
    summary: "系统分为员工权限（manager）与超级管理员权限（admin）。",
    bullets: [
      "员工可用：桌台、记录、订金、食客、日历、待办、订单打印。",
      "仅超级管理员：系统设置、员工账号、短信设置、日志与维护操作。",
      "手册中标记“仅超级管理员”的内容，需要 admin 账号操作。",
    ],
    keywords: ["权限", "角色", "管理员", "员工", "super admin"],
  },
  {
    id: "quick-start",
    title: "快速上手",
    permission: "all",
    summary: "建议按“配置基础数据 -> 录入/导入预订 -> 日常运营”顺序使用。",
    bullets: [
      "先维护桌台与运营时段，确保自动分桌与日历统计准确。",
      "新店首次使用，建议先做一键备份再执行导入。",
      "导入历史预订前，可先用“导入前清理预订信息（自动备份）”。",
      "每日开店优先看“待办”处理待确认预订与待付订金。",
    ],
    keywords: ["上手", "流程", "导入", "待办", "备份"],
  },
  {
    id: "floor",
    title: "桌台管理与排台",
    permission: "all",
    summary: "在桌台页进行排台、占用锁定、walk-in入席和状态流转。",
    bullets: [
      "可在平面图上查看桌台容量、占用状态、锁定状态。",
      "支持手动分配多桌，系统会校验容量并给出提醒。",
      "Walk-in 入席会创建记录并更新相关统计。",
      "建议统一桌台编码，便于 CSV 导入匹配 assigned_table_codes。",
    ],
    keywords: ["桌台", "排台", "walk-in", "容量", "分配"],
  },
  {
    id: "reservations",
    title: "记录（预订管理）",
    permission: "all",
    summary: "用于创建、筛选、编辑、取消预订及补发短信。",
    bullets: [
      "可按日期区间、状态、时段、姓名/手机号筛选预订。",
      "新建预订右侧可查看客户画像与历史预订（含历史备注）。",
      "补发短信按钮受时间、手机号有效性、walk-in 等条件限制。",
      "状态流转建议按业务实际进行，避免统计口径混乱。",
    ],
    keywords: ["预订", "记录", "筛选", "补发短信", "历史备注"],
  },
  {
    id: "deposits",
    title: "订金管理",
    permission: "all",
    summary: "用于登记、更新、核销订金，支持和预订记录关联。",
    bullets: [
      "常用状态：pending/paid/refunded/cancelled。",
      "建议在备注记录收款渠道、退款原因、业务凭证号。",
      "与预订绑定时可用于待办统计与财务核对。",
    ],
    keywords: ["订金", "pending", "paid", "退款", "核销"],
  },
  {
    id: "customers",
    title: "食客档案",
    permission: "all",
    summary: "按手机号唯一聚合客户信息，支持标签与备注维护。",
    bullets: [
      "列表默认按预订次数降序，便于优先识别高频客户。",
      "系统会记录最近姓名与历史别名，避免同号不同名丢失信息。",
      "标签建议统一口径，如“忌口”“纪念日”“VIP”。",
    ],
    keywords: ["食客", "客户", "别名", "标签", "手机号"],
  },
  {
    id: "calendar",
    title: "日历与趋势",
    permission: "all",
    summary: "查看月度预订热度、每日分布、农历与节假日提示。",
    bullets: [
      "顶部支持上月/下月切换，按月查看预订密度。",
      "日历格显示：当日总预订/总人数 + 各时段 x/y。",
      "左侧趋势图包含“每日预订趋势”与“月度预订趋势”。",
      "月度趋势固定从系统最早数据到真实当前月，不受选月影响。",
    ],
    keywords: ["日历", "趋势", "农历", "节假日", "月度"],
  },
  {
    id: "data-import",
    title: "数据管理：导入导出",
    permission: "admin",
    summary: "系统设置-数据管理中支持模板下载、导出、导入及导入前清理。",
    bullets: [
      "客户导入支持重复手机号策略：跳过或覆盖。",
      "预订导入支持重复预订策略：跳过或覆盖。",
      "预订导入前可按时间段清理预订与关联订金，并自动备份。",
      "导入时会做基础校验：日期、时间、人数、手机号、桌台编码。",
    ],
    keywords: ["导入", "导出", "CSV", "清理", "重复策略"],
  },
  {
    id: "backup",
    title: "数据库备份与恢复",
    permission: "admin",
    summary: "支持手动备份、自动备份计划、备份清单下载、从备份恢复。",
    bullets: [
      "高风险操作（清理、恢复）前，系统会自动创建备份。",
      "自动备份计划可配置每日时间与保留份数。",
      "支持上传 .db 恢复与从现有备份恢复，恢复后建议重启后端。",
    ],
    keywords: ["备份", "恢复", "自动备份", "db", "下载"],
  },
  {
    id: "logs",
    title: "日志审计",
    permission: "admin",
    summary: "可查询操作日志与短信发送日志，支持按维度筛选与分页。",
    bullets: [
      "操作日志支持按账号、时间、类别、动作筛选。",
      "短信日志支持按号码、类型、用途、状态筛选。",
      "建议定期检查失败短信与关键维护操作。",
    ],
    keywords: ["日志", "审计", "短信日志", "操作日志", "筛选"],
  },
  {
    id: "users-settings-sms",
    title: "系统设置 / 员工账号 / 短信设置",
    permission: "admin",
    summary: "超级管理员可维护品牌配置、员工账号、短信通道与模板。",
    bullets: [
      "系统设置含品牌、运营时段、活动文案、数据管理、日志。",
      "员工账号仅允许创建与维护后台账号权限。",
      "短信设置建议先做连通性测试，再启用业务发送。",
    ],
    keywords: ["系统设置", "员工账号", "短信", "模板", "权限"],
  },
  {
    id: "faq",
    title: "常见问题",
    permission: "all",
    summary: "覆盖导入失败、桌台不生效、统计不一致等常见问题。",
    bullets: [
      "导入报“桌台不存在”：检查 CSV 桌台编码是否与系统 table.code 一致。",
      "历史备注未显示：在新建预订右侧历史清单中可查看历史备注字段。",
      "统计差异：确认是否包含已取消/终态记录，注意筛选范围。",
      "恢复数据库后异常：建议重启后端服务刷新连接。",
    ],
    keywords: ["FAQ", "导入失败", "桌台", "统计", "备注"],
  },
];

function permissionLabel(permission: ManualSection["permission"]): string {
  return permission === "admin" ? "仅超级管理员" : "员工可用";
}

export function AdminHelpPage() {
  const [kw, setKw] = useState("");
  const query = kw.trim().toLowerCase();

  const sections = useMemo(() => {
    if (!query) return SECTIONS;
    return SECTIONS.filter((s) => {
      const text = [
        s.title,
        s.summary,
        ...s.bullets,
        ...s.keywords,
        permissionLabel(s.permission),
      ]
        .join("\n")
        .toLowerCase();
      return text.includes(query);
    });
  }, [query]);

  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 w-full flex-col overflow-hidden px-4 py-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h1 className="font-display text-xl font-semibold text-ink-900">
          系统说明 / 操作手册
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          覆盖业务流程、功能说明、权限边界、导入规范与常见问题。可输入关键词检索。
        </p>
        <div className="mt-3">
          <input
            type="search"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索关键词，例如：导入、备份、权限、短信、桌台…"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
        {sections.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
            未找到匹配内容，请更换关键词。
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((s) => (
              <article
                key={s.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-ink-900">
                    {s.title}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      s.permission === "admin"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {permissionLabel(s.permission)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-600">{s.summary}</p>
                <ul className="mt-2 space-y-1 text-sm text-stone-700">
                  {s.bullets.map((b) => (
                    <li key={b} className="leading-6">
                      - {b}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

