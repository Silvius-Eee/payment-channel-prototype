// Fictional demo data. No real channel, company, merchant or person.

const ROLES = {
  sales: { name: "商务", person: "周舟", sees: "mine", edit: "all", submit: true, note: "只看、只改自己负责的渠道" },
  ops: { name: "运营", person: "陈晨", sees: "mine", edit: "all", submit: true, note: "只看、只改自己负责的渠道" },
  product: { name: "产品", person: "林夏", sees: "all", edit: "method", submit: false, note: "看得到全部渠道，只能改支付方式" },
  lead: { name: "负责人", person: "许然", sees: "all", edit: "none", submit: false, note: "看得到全部渠道，负责分配、报价和终审" },
};

const SALES_PEOPLE = ["周舟", "赵越"];

// method: true marks a payment-method field, the only kind Product may edit
const PRODUCTS = [
  { key: "payin", name: "Payin", label: "收款", fields: [
    { key: "currency", name: "收款币种" },
    { key: "settle", name: "结算周期" },
    { key: "fee", name: "通道费率" },
    { key: "method", name: "支付方式", method: true },
  ] },
  { key: "payout", name: "Payout", label: "出款", fields: [
    { key: "currency", name: "出款币种" },
    { key: "arrival", name: "到账时效" },
    { key: "limit", name: "单笔限额" },
    { key: "method", name: "出款方式", method: true },
  ] },
  { key: "issuing", name: "发卡", label: "发卡", fields: [
    { key: "network", name: "卡组织" },
    { key: "type", name: "卡类型" },
    { key: "region", name: "发卡地区" },
    { key: "threeDS", name: "3DS 验证" },
  ] },
  { key: "account", name: "全球账户", label: "全球账户", fields: [
    { key: "currency", name: "账户币种" },
    { key: "opening", name: "开户时效" },
    { key: "collect", name: "收款方式" },
    { key: "custody", name: "资金托管" },
  ] },
];

// who: "lead" means the Lead role approves; any other value is a review team simulated in the demo
const STAGES = [
  { key: "compliance", name: "合规", who: "合规团队" },
  { key: "legal", name: "法务", who: "法务团队" },
  { key: "pricing", name: "报价", who: "lead" },
  { key: "funds", name: "资金", who: "资金团队" },
  { key: "launch", name: "上线", who: "lead" },
];

const RETURN_REASONS = [
  "资料不完整，请补充后重新提交",
  "费率与合同不一致，请核对",
  "资金托管银行需补充协议编号",
];

// status: draft | review | returned | live; stage is the index into STAGES
function seedChannels() {
  return [
    {
      id: "A", name: "渠道 A", region: "拉美", sales: "周舟", ops: "陈晨", status: "draft", stage: 0,
      quote: { pct: 2.6, fixed: 0.3 },
      products: {
        payin: { currency: "巴西雷亚尔、墨西哥比索", settle: "T+2", fee: "1.8% + 0.20 美元", method: "本地钱包、银行转账" },
        payout: { currency: "美元、欧元", arrival: "T+1", limit: "5 万美元", method: "本地清算、SWIFT" },
        issuing: { network: "Visa", type: "虚拟卡", region: "拉美", threeDS: "" },
        account: { currency: "美元、英镑", opening: "3 个工作日", collect: "", custody: "" },
      },
      log: [["11-03 10:12", "周舟", "创建渠道"], ["11-04 15:40", "陈晨", "录入 Payout 能力"]],
    },
    {
      id: "B", name: "渠道 B", region: "东南亚", sales: "周舟", ops: "陈晨", status: "review", stage: 2,
      quote: { pct: 2.2, fixed: 0.25 },
      products: {
        payin: { currency: "新加坡元、泰铢", settle: "T+1", fee: "1.5% + 0.15 美元", method: "本地钱包、二维码" },
        payout: { currency: "美元", arrival: "当天", limit: "2 万美元", method: "本地清算" },
      },
      log: [["11-05 09:30", "周舟", "提交审批"], ["11-06 11:02", "合规团队", "合规审核通过"], ["11-07 16:45", "法务团队", "法务审核通过"]],
    },
    {
      id: "C", name: "渠道 C", region: "欧洲", sales: "赵越", ops: "孙苗", status: "live", stage: 5,
      quote: { pct: 1.9, fixed: 0.25 },
      products: {
        payin: { currency: "欧元、英镑", settle: "T+1", fee: "1.2% + 0.10 美元", method: "银行卡、SEPA 转账" },
        payout: { currency: "欧元", arrival: "T+1", limit: "10 万欧元", method: "SEPA、SWIFT" },
        issuing: { network: "Mastercard", type: "实体卡、虚拟卡", region: "欧洲", threeDS: "已开启" },
      },
      log: [["10-21 10:00", "赵越", "提交审批"], ["10-28 17:20", "许然", "终审通过，渠道上线"]],
    },
    {
      id: "D", name: "渠道 D", region: "中东", sales: "赵越", ops: "孙苗", status: "draft", stage: 0,
      quote: { pct: 2.8, fixed: 0.3 },
      products: {
        payin: { currency: "阿联酋迪拉姆", settle: "T+3", fee: "2.1% + 0.25 美元", method: "" },
        account: { currency: "美元、迪拉姆", opening: "5 个工作日", collect: "本地账户", custody: "合作银行" },
      },
      log: [["11-08 14:22", "赵越", "创建渠道"]],
    },
    {
      id: "E", name: "渠道 E", region: "北美", sales: "周舟", ops: "孙苗", status: "returned", stage: 3,
      returnReason: "资金托管银行需补充协议编号",
      quote: { pct: 2.0, fixed: 0.3 },
      products: {
        payout: { currency: "美元、加元", arrival: "T+1", limit: "5 万美元", method: "本地清算、SWIFT" },
        account: { currency: "美元、加元", opening: "2 个工作日", collect: "本地账户", custody: "" },
      },
      log: [["11-02 10:05", "周舟", "提交审批"], ["11-09 09:48", "资金团队", "资金审核退回：资金托管银行需补充协议编号"]],
    },
  ];
}
