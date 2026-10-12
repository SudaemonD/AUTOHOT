// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类（评测、观点）：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "new-cars", label: "新车", section: "新车上市/改款", guide: "全新车型、换代或年度改款的正式上市、预售、交付、定价与配置公布。同一款车的官图、配置、价格与续航版本属于同一次发布；竞品对比与试驾体验归评测，行业层面的销量与经营归行业。" },
  { key: "tech", label: "技术", feedLabel: "汽车技术", section: "技术与智驾", guide: "电池、电机、电控（三电）、整车平台与电子电气架构、智能驾驶与智能座舱、芯片与传感器、OTA 大版本的技术发布与能力变化。以零部件或供应链为主线的报道不算；车型本身的上市归新车，技术发布之后的第三方实测归评测。" },
  { key: "industry", label: "行业", feedLabel: "行业动态", section: "行业动态", guide: "已发生的车企经营、销量与交付、财报、融资并购、人事、合作、价格与渠道变化、出海与产能。月度与周度销量榜归这里；新闻由当事方发帖、带有态度，也不因此变成观点。" },
  { key: "policy", label: "政策", feedLabel: "政策法规", section: "政策法规", guide: "法规、国家标准、准入与资质、补贴与双积分、召回与缺陷调查、监管处罚、出口关税与海外合规。征求意见稿与正式发布分开记；真实事故的调查进展归这里，围绕事故的技术分析归技术、实测归评测。" },
  { key: "review", label: "评测", section: "评测与观点", guide: "机构或媒体对具体车型、技术或产品的实测、续航与智驾评测、横评与榜单。导购、促销优惠与厂商组织的试驾软文不归这里。", commentary: true },
  { key: "opinion", label: "观点", section: "评测与观点", guide: "重点是作者的解释、判断、主张、预测、评论或访谈观点。讨论销量不自动归行业，作者是名人不自动归观点。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布（汽车行业是新车上市）：日报报头的“N 款新车”、改分类后修订已出的报告都按它数。
 * category 是类别，tag 是标签，两者都对上才算；年度改款与配置调整不算，所以只数“新车发布”。
 * unit 接在数字后面。没有这样一类的行业设成 null，报头就不显示这个数。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "new-cars", tag: "新车发布", unit: "款新车" };

/** 周报月报的总述可以直接写、不必在报道里找到出处的行业通用词（小写）。站名会自动算进去。 */
export const PLAIN_TERMS: readonly string[] = ["ev", "bev", "phev", "erev", "suv", "mpv", "ota", "noa", "adas", "l2", "l3", "cltc", "wltc", "nedc", "ceo", "ipo"];

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = ["new_car_launch", "product_update", "how_to_guide", "tech_report", "industry_event", "opinion_analysis", "review_explainer"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。最后一个是兜底，新增分类标签要加在它前面。 */
export const CATEGORY_TAGS = [
  "新车发布", "改款/年款", "技术发布", "销量/交付", "行业动态", "政策/监管", "召回/安全",
  "评测", "对比/横评", "用车/攻略", "观点/分析", "趋势/现象", "非汽车/通用",
  "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "纯电", "插混/增程", "换电", "800V/快充", "电池", "智驾", "智舱", "车机/OTA", "端到端", "激光雷达", "底盘/操控", "安全/碰撞", "出口/出海", "新势力", "价格/权益",
] as const;

/** 可选的实体标签（公司、品牌）。必须是下面 ENTITIES 里 displayTag 非 null 的那些名字。 */
export const ENTITY_TAGS = ["比亚迪", "特斯拉", "小米汽车", "华为", "蔚来", "小鹏", "理想", "零跑", "吉利", "长安", "奇瑞", "长城", "丰田", "大众", "宝马"] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  "新车/上市": "新车发布", 上市: "新车发布", 预售: "新车发布", 发布: "新车发布", 换代: "新车发布", 首款: "新车发布", 新车: "新车发布",
  改款: "改款/年款", 年款: "改款/年款", 小改款: "改款/年款", 新版本: "改款/年款",
  三电: "技术发布", 电池: "技术发布", 电驱: "技术发布", 电控: "技术发布", 平台: "技术发布", 架构: "技术发布",
  芯片: "技术发布", 智驾: "技术发布", 智舱: "技术发布", 座舱: "技术发布", 开源: "技术发布", 技术: "技术发布",
  销量: "销量/交付", 交付: "销量/交付", 上险量: "销量/交付", 销量榜: "销量/交付", 月销: "销量/交付", 周销: "销量/交付",
  融资: "行业动态", 收购: "行业动态", 并购: "行业动态", 投资: "行业动态", 合作: "行业动态", 人事: "行业动态",
  价格战: "行业动态", 降价: "行业动态", 涨价: "行业动态", 渠道: "行业动态", 出海: "行业动态", 行业: "行业动态", 动态: "行业动态",
  政策: "政策/监管", 监管: "政策/监管", 法规: "政策/监管", 国标: "政策/监管", 准入: "政策/监管", 补贴: "政策/监管", 双积分: "政策/监管", 关税: "政策/监管",
  召回: "召回/安全", 缺陷: "召回/安全",
  实测: "评测", 试驾: "评测", 续航测试: "评测", 智驾评测: "评测",
  对比: "对比/横评", 横评: "对比/横评", "对比评测": "对比/横评",
  教程: "用车/攻略", 指南: "用车/攻略", 技巧: "用车/攻略", 用车: "用车/攻略", 攻略: "用车/攻略", 保养: "用车/攻略", 充电: "用车/攻略",
  观点: "观点/分析", 访谈: "观点/分析", 分析: "观点/分析", 复盘: "观点/分析", 预测: "观点/分析", 评论: "观点/分析",
  趋势: "趋势/现象", 现象: "趋势/现象",
  导购: "非汽车/通用", 促销: "非汽车/通用", 优惠: "非汽车/通用", 团购: "非汽车/通用", 二手车: "非汽车/通用",
  零部件: "非汽车/通用", 供应链: "非汽车/通用", 商用车: "非汽车/通用", 卡车: "非汽车/通用", 摩托车: "非汽车/通用",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/**
 * 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看，也是把事实主体对到公司的口径；otherNames 是公司自己的其他称呼
 * （子品牌、官方账号名），把事实的主体对到发布方时也认它们。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; otherNames?: string[] }> = {
  byd: { name: "比亚迪", displayTag: "比亚迪", aliases: ["比亚迪", "BYD"], otherNames: ["比亚迪汽车", "腾势", "Denza", "方程豹", "仰望", "Yangwang", "王朝", "海洋"] },
  tesla: { name: "特斯拉", displayTag: "特斯拉", aliases: ["特斯拉", "Tesla", "Model 3", "Model Y", "Model S", "Model X", "Cybertruck"], otherNames: ["特斯拉中国", "Tesla China", "Tesla Energy"] },
  xiaomi: { name: "小米汽车", displayTag: "小米汽车", aliases: ["小米汽车", "Xiaomi Auto", "SU7", "YU7"], otherNames: ["小米集团", "Xiaomi", "小米"] },
  huawei: { name: "华为", displayTag: "华为", aliases: ["华为", "Huawei", "鸿蒙智行", "HIMA"], otherNames: ["问界", "AITO", "智界", "Luxeed", "享界", "尊界", "尚界", "乾崑", "ADS", "华为车 BU"] },
  nio: { name: "蔚来", displayTag: "蔚来", aliases: ["蔚来", "NIO"], otherNames: ["乐道", "ONVO", "萤火虫", "Firefly", "蔚来能源", "NIO Power"] },
  xpeng: { name: "小鹏", displayTag: "小鹏", aliases: ["小鹏", "小鹏汽车", "XPeng"], otherNames: ["小鹏汇天", "MONA", "小鹏汽车科技"] },
  "li-auto": { name: "理想", displayTag: "理想", aliases: ["理想", "理想汽车", "Li Auto"], otherNames: ["理想 ONE", "MEGA"] },
  leapmotor: { name: "零跑", displayTag: "零跑", aliases: ["零跑", "零跑汽车", "Leapmotor"], otherNames: ["零跑国际"] },
  geely: { name: "吉利", displayTag: "吉利", aliases: ["吉利", "Geely"], otherNames: ["吉利汽车", "极氪", "Zeekr", "领克", "Lynk & Co", "银河", "Galaxy", "沃尔沃", "Volvo", "极星", "Polestar"] },
  changan: { name: "长安", displayTag: "长安", aliases: ["长安", "长安汽车", "Changan"], otherNames: ["深蓝", "Deepal", "阿维塔", "Avatr", "启源", "NEVO", "长安凯程", "凯程", "Kaicheng", "长安福特", "Changan Ford", "长安马自达", "Changan Mazda"] },
  chery: { name: "奇瑞", displayTag: "奇瑞", aliases: ["奇瑞", "Chery"], otherNames: ["奇瑞汽车", "星途", "Exeed", "iCAR", "捷途", "Jetour", "风云"] },
  "great-wall": { name: "长城", displayTag: "长城", aliases: ["长城", "长城汽车", "Great Wall", "GWM"], otherNames: ["哈弗", "Haval", "魏牌", "WEY", "坦克", "Tank", "欧拉", "ORA"] },
  saic: { name: "上汽", displayTag: null, aliases: ["上汽", "上汽集团", "SAIC"], otherNames: ["荣威", "Roewe", "名爵", "MG", "智己", "IM Motors", "飞凡", "Rising", "五菱", "Wuling", "宝骏"] },
  gac: { name: "广汽", displayTag: null, aliases: ["广汽", "广汽集团", "GAC"], otherNames: ["埃安", "AION", "昊铂", "Hyptec", "传祺", "Trumpchi"] },
  dongfeng: { name: "东风", displayTag: null, aliases: ["东风", "东风汽车", "Dongfeng"], otherNames: ["岚图", "Voyah", "奕派", "eπ", "纳米", "猛士", "M-Hero"] },
  toyota: { name: "丰田", displayTag: "丰田", aliases: ["丰田", "Toyota"], otherNames: ["丰田中国", "一汽丰田", "广汽丰田", "雷克萨斯", "Lexus", "bZ"] },
  volkswagen: { name: "大众", displayTag: "大众", aliases: ["大众", "大众汽车", "Volkswagen", "VW"], otherNames: ["一汽-大众", "上汽大众", "一汽大众", "ID.", "CARIAD"] },
  bmw: { name: "宝马", displayTag: "宝马", aliases: ["宝马", "BMW"], otherNames: ["华晨宝马", "BMW i", "MINI", "Neue Klasse"] },
  "mercedes-benz": { name: "奔驰", displayTag: null, aliases: ["奔驰", "梅赛德斯-奔驰", "Mercedes-Benz", "Mercedes"], otherNames: ["北京奔驰", "AMG", "迈巴赫", "Maybach"] },
  hyundai: { name: "现代", displayTag: null, aliases: ["现代汽车", "Hyundai"], otherNames: ["北京现代", "起亚", "Kia", "捷尼赛思", "Genesis"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 中文品牌名很多是日常用词（理想、大众、现代、长安、长城、坦克），正则要带汽车语境，不能只写品牌名。
 * 行业没有这个问题时可以留空数组。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "byd", name: "比亚迪", patterns: [/比亚迪|\bBYD\b|腾势|\bDenza\b|方程豹|仰望/i] },
  { id: "tesla", name: "特斯拉", patterns: [/特斯拉|\bTesla\b|\bModel [3YSX]\b|\bCybertruck\b/i] },
  { id: "xiaomi", name: "小米汽车", patterns: [/小米汽车|小米\s?(?:SU7|YU7)|\bSU7\b|\bYU7\b|Xiaomi Auto/i] },
  { id: "huawei", name: "华为", patterns: [/鸿蒙智行|\bHIMA\b|问界|\bAITO\b|智界|享界|尊界|尚界|\bADS\s?[0-9]/i] },
  { id: "nio", name: "蔚来", patterns: [/\bNIO\b|蔚来|乐道|\bONVO\b|萤火虫|\bFirefly\b/i] },
  { id: "xpeng", name: "小鹏", patterns: [/小鹏汽车|\bXPeng\b|\bMONA\b|小鹏(?:P7|G6|G9|X9|汇天)/i] },
  { id: "li-auto", name: "理想", patterns: [/理想汽车|\bLi ?Auto\b|理想\s?(?:L[6-9]|MEGA|i[68]|ONE)/i] },
  { id: "leapmotor", name: "零跑", patterns: [/零跑|\bLeapmotor\b/i] },
  { id: "geely", name: "吉利", patterns: [/吉利汽车|吉利控股|\bGeely\b|极氪|\bZeekr\b|领克|\bLynk/i] },
  { id: "changan", name: "长安", patterns: [/长安汽车|\bChangan\b|深蓝|\bDeepal\b|阿维塔|\bAvatr\b|启源|\bNEVO\b|长安凯程|凯程|\bKaicheng\b|长安福特|Changan Ford|长安马自达|Changan Mazda/i] },
  { id: "chery", name: "奇瑞", patterns: [/奇瑞|\bChery\b|星途|\bExeed\b|\biCAR\b/i] },
  { id: "great-wall", name: "长城", patterns: [/长城汽车|\bGWM\b|哈弗|\bHaval\b|魏牌|\bWEY\b|坦克\s?[3-8]00|欧拉|\bORA\b/i] },
  { id: "saic", name: "上汽", patterns: [/上汽|荣威|\bRoewe\b|名爵|\bMG\b|智己|五菱|\bWuling\b|宝骏/i] },
  { id: "gac", name: "广汽", patterns: [/广汽|埃安|\bAION\b|昊铂|\bHyptec\b|传祺|\bTrumpchi\b/i] },
  { id: "dongfeng", name: "东风", patterns: [/东风汽车|岚图|\bVoyah\b|奕派|\beπ\b/i] },
  { id: "toyota", name: "丰田", patterns: [/丰田|\bToyota\b|雷克萨斯|\bLexus\b/i] },
  { id: "volkswagen", name: "大众", patterns: [/大众汽车|一汽[-－]?大众|上汽大众|\bVolkswagen\b|\bVW\b|\bCARIAD\b/i] },
  { id: "bmw", name: "宝马", patterns: [/宝马|\bBMW\b|\bMINI\b|华晨宝马/i] },
  { id: "mercedes-benz", name: "奔驰", patterns: [/奔驰|梅赛德斯|Mercedes(?:-Benz)?|\bAMG\b|迈巴赫|Maybach/i] },
  { id: "hyundai", name: "现代", patterns: [/现代汽车|北京现代|\bHyundai\b|起亚|\bKia\b|捷尼赛思|\bGenesis\b/i] },
  { id: "stellantis", name: "Stellantis", patterns: [/stellantis|\bPeugeot\b|标致|雪铁龙|Citro[eë]n|菲亚特|\bFiat\b|\bJeep\b|欧宝|\bOpel\b/i] },
  { id: "ford", name: "福特", patterns: [/\bFord\b|福特|林肯|\bLincoln\b/i] },
  { id: "gm", name: "通用汽车", patterns: [/通用汽车|\bGeneral Motors\b|\bCadillac\b|凯迪拉克|\bBuick\b|别克|雪佛兰|Chevrolet/i] },
  { id: "nissan", name: "日产", patterns: [/日产|\bNissan\b|英菲尼迪|\bInfiniti\b/i] },
  { id: "honda", name: "本田", patterns: [/本田|\bHonda\b|讴歌|\bAcura\b/i] },
  { id: "nio-firefly", name: "萤火虫", patterns: [/萤火虫|\bFirefly\b/i] },
  { id: "momenta", name: "Momenta", patterns: [/momenta/i] },
  { id: "horizon-robotics", name: "地平线", patterns: [/地平线机器人|\bHorizon Robotics\b|征程\s?[0-9]/i] },
  { id: "hesai", name: "禾赛", patterns: [/禾赛|\bHesai\b/i] },
  { id: "catl", name: "宁德时代", patterns: [/宁德时代|\bCATL\b|麒麟电池|神行电池/i] },
  { id: "byd-fudi", name: "弗迪电池", patterns: [/弗迪电池|弗迪动力|刀片电池/i] },
  { id: "cpca", name: "乘联会", patterns: [/乘[用联]联会|乘联分会|\bCPCA\b/i] },
  { id: "caam", name: "中汽协", patterns: [/中汽协|中国汽车工业协会|\bCAAM\b/i] },
  { id: "miit", name: "工信部", patterns: [/工信部|工业和信息化部|\bMIIT\b/i] },
];

/** 这些域名上的文章，发布方就是对应的公司（汽车之家、懂车帝这类媒体平台不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "byd", domains: ["byd.com", "bydauto.com.cn"] },
  { entityId: "tesla", domains: ["tesla.com", "tesla.cn"] },
  { entityId: "xiaomi", domains: ["xiaomiev.com", "mi.com"] },
  { entityId: "huawei", domains: ["huawei.com"] },
  { entityId: "nio", domains: ["nio.com", "nio.cn"] },
  { entityId: "xpeng", domains: ["xiaopeng.com", "xpeng.com"] },
  { entityId: "li-auto", domains: ["lixiang.com"] },
  { entityId: "leapmotor", domains: ["leapmotor.com"] },
  { entityId: "geely", domains: ["geely.com", "zgh.com", "zeekrgroup.com"] },
  { entityId: "changan", domains: ["changan.com.cn"] },
  { entityId: "chery", domains: ["chery.cn"] },
  { entityId: "great-wall", domains: ["gwm.com.cn"] },
  { entityId: "saic", domains: ["saicmotor.com"] },
  { entityId: "gac", domains: ["gac.com.cn"] },
  { entityId: "dongfeng", domains: ["dfmc.com.cn"] },
  { entityId: "toyota", domains: ["toyota.com", "toyota.com.cn"] },
  { entityId: "volkswagen", domains: ["volkswagen-newsroom.com", "vw.com.cn"] },
  { entityId: "bmw", domains: ["bmwgroup.com", "press.bmwgroup.com", "bmw.com.cn"] },
  { entityId: "mercedes-benz", domains: ["mercedes-benz.com", "media.mercedes-benz.com"] },
  { entityId: "hyundai", domains: ["hyundai.com", "hyundai.com.cn"] },
];

/** 原文里的这些写法也算提到了对应公司：子品牌名本身不含母品牌名，需要单独列出来。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "byd", pattern: /腾势|\bDenza\b|方程豹|仰望/i },
  { entityId: "huawei", pattern: /鸿蒙智行|\bHIMA\b|问界|\bAITO\b|智界|享界|尊界|尚界|乾崑/i },
  { entityId: "geely", pattern: /极氪|\bZeekr\b|领克|\bLynk\b/i },
  { entityId: "nio", pattern: /乐道|\bONVO\b|萤火虫|\bFirefly\b/i },
  { entityId: "changan", pattern: /深蓝|\bDeepal\b|阿维塔|\bAvatr\b|启源|\bNEVO\b|凯程|\bKaicheng\b|长安福特|Changan Ford|长安马自达|Changan Mazda/i },
  { entityId: "chery", pattern: /星途|\bExeed\b|\biCAR\b|捷途|\bJetour\b/i },
  { entityId: "great-wall", pattern: /哈弗|\bHaval\b|魏牌|\bWEY\b|坦克|\bTank\b|欧拉|\bORA\b/i },
  { entityId: "saic", pattern: /荣威|\bRoewe\b|名爵|\bMG\b|智己|五菱|\bWuling\b/i },
  { entityId: "gac", pattern: /埃安|\bAION\b|昊铂|\bHyptec\b|传祺|\bTrumpchi\b/i },
  { entityId: "dongfeng", pattern: /岚图|\bVoyah\b|奕派|\beπ\b|猛士|\bM-Hero\b/i },
];
