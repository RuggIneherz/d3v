import { $, getLS, setLS, now, UX, fetchChat } from '/js/utils.js';
import { APIConfig } from '/js/api-config.js';

export function initNameGen() {


  const LS = {
    fav:"ng_fav_v8", groups:"ng_groups_v8", his:"ng_his_v8",
    recent:"ng_recent_v8", opts:"ng_opts_v8", ban:"ng_black_v8", lex:"ng_lex_extra_v8"
  };

  const tip=$("tipName"), resultList=$("resultList"), favList=$("favList"), hisList=$("hisList");
  const setTip=t=>{tip.textContent=t||""; if(t) setTimeout(()=>tip.textContent===t&&(tip.textContent=""),1600);}
  const pick=arr=>arr[Math.floor(Math.random()*arr.length)];

  // --- 工具 ---
  function parseCommaList(raw){
    const s=(raw||"").trim();
    if(!s) return [];
    if(/[，,]/.test(s)) return s.split(/[，,]/).map(x=>x.trim()).filter(Boolean);
    return [...s].filter(Boolean);
  }

  function hitTempExclude(name,tempCharsRaw,tempWordsRaw){
    const chars=parseCommaList(tempCharsRaw);
    const words=parseCommaList(tempWordsRaw);
    for(const c of chars){ if(name.includes(c)) return true; }
    for(const w of words){ if(name.includes(w)) return true; }
    return false;
  }

  // ===== 基础词库 =====
  const baseLex = {
    surnamePacks:{
      common:["赵","钱","孙","李","周","吴","郑","王","冯","陈","蒋","沈","韩","杨","朱","秦","许","何","吕","施","张","孔","曹","华","金","魏","陶","姜","谢","邹","章","云","苏","潘","范","彭","郎","鲁","韦","马","方","俞","任","袁","柳","唐","薛","雷","贺","倪","汤","滕","殷","罗","毕","安","常","于","时","傅","齐","康","伍","余","元","顾","孟","黄","穆","萧","尹","姚","邵","汪","祁","戴","宋","董","梁","杜","阮","蓝","闵"],
      jiangnan:["沈","顾","陆","谢","许","苏","宋","程","周","方","章","严","潘","曹","蒋","韩","叶","乔","季","顾"],
      beidi:["赵","燕","秦","魏","韩","邢","常","马","霍","尹","高","石","贺","雷","卢","郝","安","曹","姚","段"],
      xiyu:["慕","宁","安","白","乌","阿","洛","顾","祁","沙","边","蓝","尉","司","陆","沈","唐","贺","穆","罗"]
    },
    doubleSurnames:["欧阳","司马","上官","诸葛","夏侯","慕容","尉迟","公孙"],
    chars:{
      male:{
        ancient:["玄","承","景","砚","川","陵","珩","晏","昱","衡","曜","峥","翊","霄","澈","骁","肃","怀","瑾","行"],
        modern:["宇","轩","泽","航","诚","昊","铭","杰","辰","烨","森","毅","睿","阳","博","宁","昀","祺","朗","霖"],
        republic:["文","明","德","志","怀","远","成","国","书","正","修","启","元","诚","义","廷","绍","仁","伯","宗"],
        fantasy:["烛","霜","岚","曜","渊","烬","翼","凛","宸","麟","魄","夜","岑","祈","弦","珀","羽","岱","澄","峦"]
      },
      female:{
        ancient:["绾","清","婉","昭","璃","妤","芷","瑶","汐","棠","韵","若","绮","凝","泠","音","萱","雅","宁","然"],
        modern:["悦","妍","宁","可","然","琪","瑾","欣","彤","语","菲","茉","伊","歆","珂","雅","沁","萌","希","晴"],
        republic:["兰","雅","清","秀","文","静","慧","英","素","琴","玉","华","珍","淑","宁","如","曼","仪","美","芳"],
        fantasy:["月","霜","岚","星","鸢","露","灵","雪","汐","瑾","澄","夜","歌","羽","梦","薇","悠","璃","岚","音"]
      },
      neutral:{
        ancient:["安","言","澄","青","宁","简","行","予","迟","岫","知","闻","临","和","白","朴","执","归","时","砚"],
        modern:["晨","宁","言","一","川","可","念","林","禾","予","昀","舟","夏","柠","宥","野","祈","岚","朵","澄"],
        republic:["文","安","宁","和","清","远","知","明","简","平","之","元","礼","行","书","若","青","白","成","义"],
        fantasy:["月","星","雾","岚","羽","歌","夜","澄","珀","灵","霁","雪","汐","曜","祈","弦","露","梦","澜","宁"]
      }
    },
    worldviewBoost:{
      all:[],
      xianxia:["玄","灵","尘","霄","渊","衡","羽","瑶","清","岚"],
      wuxia:["岳","行","川","墨","锋","岚","霁","青","影","舟"],
      republic:["之","文","德","怀","志","明","若","兰","雅","清"],
      western:["维","洛","泽","伊","兰","诺","艾","菲","亚","安"],
      steam:["维","特","洛","格","森","匠","赫","恩","瓦","德"],
      cyberpunk:["凌","序","域","流","弦","棱","曜","霁","焰","岚"],
      campus:["晨","夏","晴","言","可","禾","希","宁","远","安"],
      postapoc:["烬","荒","尘","夜","岱","岚","霜","砾","刃","影"],
      abo:["祈","澄","屿","昭","岚","舟","曜","霁","棠","予"]
    },
    enFirst:{
      male:["Aiden","Ethan","Noah","Liam","Kai","Rowan","Leon","Evan","Silas","Julian","Asher","Dorian"],
      female:["Aria","Luna","Iris","Nora","Mila","Elena","Ayla","Clara","Vera","Selene","Freya","Evelyn"],
      neutral:["River","Skyler","Avery","Morgan","Quinn","Sage","Nova","Reese","Jamie","Alex","Casey","Riley"]
    },
    enLast:{
      common:["Smith","Clark","Miller","Hayes","Reed","Morgan","Bennett","Parker","Wright","Stone","Brooks","Cole"],
      western:["Blackwood","Ashford","Ravens","Wyndham","Sterling","Fox","Hawthorne","Graves","Everett","Fletcher","Rowe","Thorne"],
      steam:["Brass","Whitlock","Gearson","Hartwell","Crowley","Langley","Mercer","Abbott","Sinclair","Carver","Barton","Huxley"],
      cyberpunk:["Kade","Nyx","Voss","Drake","Sato","Kiro","Vale","Rook","Cross","Nero","Vega","Arden"]
    },
    nickCore:["宁","岚","澄","羽","棠","璃","祈","曜","汐","柚","禾","昭","绾","霁","夏","舟","言","安","宥","星","梨","葵","雾","音","晴"]
  };
// ===== v2 多语种名字词库（非中文/非港澳台一律 原文（中文对照））=====
  const NAME_CULT = {
    kr: {
      surnames: [["김","金"],["이","李"],["박","朴"],["최","崔"],["정","郑"],["강","姜"],["조","赵"],["윤","尹"],["장","张"],["임","林"],["한","韩"],["오","吴"],["서","徐"],["신","申"],["권","权"],["황","黄"],["안","安"],["송","宋"],["전","全"],["홍","洪"],["배","裴"],["허","许"],["유","柳"]],
      gm: [["민준","旼俊"],["서준","瑞俊"],["도윤","道允"],["시우","时宇"],["주원","周元"],["하준","河俊"],["지호","智浩"],["지훈","智勋"],["준서","俊书"],["현우","贤宇"],["승우","承宇"],["재원","载元"],["태양","太阳"],["유찬","幼灿"],["도현","道贤"],["은우","恩宇"],["시후","时厚"],["건우","建宇"],["정우","正宇"],["예찬","艺灿"]],
      gf: [["서연","瑞妍"],["서아","瑞雅"],["지우","智友"],["서윤","瑞允"],["민서","敏书"],["하은","河恩"],["채원","采元"],["수아","秀雅"],["지민","智敏"],["유나","幼娜"],["예린","艺琳"],["다은","多恩"],["소율","素律"],["아린","雅琳"],["나은","娜恩"],["윤서","允书"],["하린","河琳"],["채은","采恩"],["지아","智雅"],["예은","艺恩"]]
    },
    jp: {
      surnames: [["佐藤","佐藤"],["鈴木","铃木"],["高橋","高桥"],["田中","田中"],["伊藤","伊藤"],["渡辺","渡边"],["山本","山本"],["中村","中村"],["小林","小林"],["加藤","加藤"],["吉田","吉田"],["山田","山田"],["佐々木","佐佐木"],["山口","山口"],["松本","松本"],["井上","井上"],["木村","木村"],["林","林"],["斎藤","斋藤"],["清水","清水"]],
      gm: [["蓮","莲"],["翔太","翔太"],["陽翔","阳翔"],["湊","凑"],["樹","树"],["颯真","飒真"],["陽向","阳向"],["悠真","悠真"],["朝陽","朝阳"],["大翔","大翔"],["蒼","苍"],["律","律"],["大和","大和"],["伊織","伊织"],["晴","晴"],["嵐","岚"],["陸","陆"],["海斗","海斗"],["颯","飒"],["蓮人","莲人"]],
      gf: [["陽葵","阳葵"],["芽依","芽依"],["結菜","结菜"],["咲良","咲良"],["凛","凛"],["結衣","结衣"],["美月","美月"],["葵","葵"],["楓","枫"],["琴葉","琴叶"],["ひなた","日向"],["紬","紬"],["柚葉","柚叶"],["莉子","莉子"],["紗良","纱良"],["澪","澪"],["一花","一花"],["小夏","小夏"],["千尋","千寻"],["雪乃","雪乃"]]
    },
    hk: {
      surnames: [["陳","Chan"],["李","Lee"],["黃","Wong"],["張","Cheung"],["梁","Leung"],["何","Ho"],["羅","Law"],["高","Ko"],["林","Lam"],["鄭","Cheng"],["謝","Tse"],["吳","Ng"],["曾","Tsang"],["鄧","Tang"],["彭","Pang"],["廖","Liu"],["周","Chow"],["葉","Yip"],["蘇","So"],["馬","Ma"],["盧","Lo"],["蔡","Choi"],["司徒","Szeto"],["岑","Shum"]],
      gm: [["文","Man"],["明","Ming"],["偉","Wai"],["強","Keung"],["傑","Kit"],["俊","Chun"],["軒","Hin"],["浩","Ho"],["誠","Shing"],["朗","Long"],["彥","Yin"],["恆","Hang"],["熙","Hei"],["諾","Nok"],["鋒","Fung"],["逸","Yat"],["霆","Ting"],["晉","Jun"],["柏","Pak"],["堯","Yiu"],["謙","Him"],["樂","Lok"]],
      gf: [["詠","Wing"],["慧","Wai"],["嘉","Ka"],["欣","Yan"],["婷","Ting"],["敏","Man"],["詩","Sze"],["琪","Ki"],["琳","Lam"],["晴","Ching"],["思","Si"],["韻","Wan"],["雪","Suet"],["瑩","Ying"],["怡","Yee"],["嫻","Han"],["芷","Tsz"],["穎","Wing"],["妍","Yin"],["凱","Hoi"],["喬","Kiu"],["瀅","Ying"]]
    },
    mo: { // 澳门华人姓氏（粤拼/澳拼生态）
      surnames: [["陳","Chan"],["吳","Ng"],["何","Ho"],["鄭","Cheang"],["黃","Vong"],["梁","Leong"],["張","Cheong"],["劉","Lao"],["羅","Lo"],["麥","Mak"],["黎","Lai"],["余","Iu"],["李","Lei"],["歐","Ao"],["岑","Sam"],["高","Kou"]]
    },
    tw: {
      surnames: ["陳","林","黃","張","李","王","吳","劉","蔡","楊","許","鄭","謝","洪","邱","曾","廖","賴","徐","莊","葉","蘇"],
      gm: ["柏翰","宥廷","冠廷","承恩","泓睿","家豪","志傑","俊宏","彥廷","皓宇","柏宇","子睿","昱翔","凱鈞","品睿","宥翔","浩恩","昱廷","柏毅","宥辰"],
      gf: ["雅婷","怡君","欣怡","淑惠","雅惠","曉萱","宜蓁","詩涵","淑芬","靜怡","佳穎","依珊","婉婷","郁婷","可喬","昕妍","語彤","芷瑄","采潔","念真"]
    },
    pt: { // 澳门土生葡人生态
      surnames: [["Silva","席尔瓦"],["Costa","科斯塔"],["Pereira","佩雷拉"],["Santos","桑托斯"],["Oliveira","奥利维拉"],["Rodrigues","罗德里格斯"],["Marques","马克斯"],["Ferreira","费雷拉"],["Gomes","戈麦斯"],["Sousa","索萨"],["Xavier","沙维尔"],["Rozário","罗萨里奥"],["Noronha","诺罗尼亚"],["Assumpção","阿松桑"]],
      gm: [["João","若昂"],["Miguel","米格尔"],["Carlos","卡洛斯"],["Afonso","阿方索"],["Lourenço","洛伦索"],["Rodrigo","罗德里戈"],["Bruno","布鲁诺"],["Filipe","菲利佩"],["Diogo","迪奥戈"],["Tomás","托马斯"],["Hugo","雨果"],["Nuno","努诺"],["Vasco","瓦斯科"]],
      gf: [["Maria","玛丽亚"],["Ana","安娜"],["Beatriz","贝阿特丽兹"],["Mariana","玛丽安娜"],["Joana","若阿娜"],["Catarina","卡塔琳娜"],["Inês","伊内斯"],["Sofia","索菲娅"],["Leonor","莱昂诺尔"],["Carolina","卡罗琳娜"],["Filipa","菲利帕"],["Margarida","玛加丽达"]]
    },
    de: {
      surnames: [["Müller","米勒"],["Schmidt","施密特"],["Schneider","施奈德"],["Fischer","费舍尔"],["Weber","韦伯"],["Wagner","瓦格纳"],["Becker","贝克尔"],["Schulz","舒尔茨"],["Lehmann","莱曼"],["Hansen","汉森"],["Olsen","奥尔森"],["Larsen","拉森"],["Andersen","安德森"],["Nilsen","尼尔森"],["Berg","贝里"],["Lund","伦德"],["Dahl","达尔"],["Holm","霍尔姆"],["Ström","斯特伦"]],
      gm: [["Lukas","卢卡斯"],["Felix","费利克斯"],["Jonas","约纳斯"],["Elias","伊莱亚斯"],["Maximilian","马克西米利安"],["Niklas","尼克拉斯"],["Florian","弗洛里安"],["Sebastian","塞巴斯蒂安"],["Klaus","克劳斯"],["Björn","比约恩"],["Lars","拉尔斯"],["Erik","埃里克"],["Sven","斯文"],["Anders","安德斯"],["Magnus","马格努斯"],["Sigurd","西古德"],["Finn","芬恩"],["Torben","托本"]],
      gf: [["Hannah","汉娜"],["Lena","莉娜"],["Sophia","索菲娅"],["Emilia","埃米莉娅"],["Mia","米娅"],["Anna","安娜"],["Clara","克拉拉"],["Greta","葛丽泰"],["Helga","赫尔加"],["Ingrid","英格丽"],["Astrid","阿斯特丽德"],["Sigrid","西格里德"],["Freya","弗蕾亚"],["Liv","丽芙"],["Solveig","苏尔维"]]
    },
    ru: {
      surnames: [["Иванов","Иванова","伊万诺夫","伊万诺娃"],["Петров","Петрова","彼得罗夫","彼得罗娃"],["Смирнов","Смирнова","斯米尔诺夫","斯米尔诺娃"],["Кузнецов","Кузнецова","库兹涅佐夫","库兹涅佐娃"],["Попов","Попова","波波夫","波波娃"],["Волков","Волкова","沃尔科夫","沃尔科娃"],["Соколов","Соколова","索科洛夫","索科洛娃"],["Морозов","Морозова","莫罗佐夫","莫罗佐娃"],["Орлов","Орлова","奥尔洛夫","奥尔洛娃"],["Зайцев","Зайцева","扎伊采夫","扎伊采娃"],["Новиков","Новикова","诺维科夫","诺维科娃"],["Павлов","Павлова","巴甫洛夫","巴甫洛娃"]],
      gm: [["Александр","亚历山大"],["Дмитрий","德米特里"],["Максим","马克西姆"],["Сергей","谢尔盖"],["Андрей","安德烈"],["Алексей","阿列克谢"],["Николай","尼古拉"],["Иван","伊万"],["Михаил","米哈伊尔"],["Артём","阿尔乔姆"],["Владимир","弗拉基米尔"],["Пётр","彼得"],["Кирилл","基里尔"],["Роман","罗曼"],["Егор","叶戈尔"]],
      gf: [["Анна","安娜"],["Мария","玛丽亚"],["София","索菲娅"],["Анастасия","阿纳斯塔西娅"],["Дарья","达莉娅"],["Екатерина","叶卡捷琳娜"],["Алиса","阿莉萨"],["Полина","波琳娜"],["Виктория","维多利亚"],["Елена","叶莲娜"],["Ольга","奥尔加"],["Наталья","娜塔莉亚"],["Татьяна","塔季扬娜"],["Ирина","伊琳娜"],["Вера","薇拉"]]
    },
    la: {
      surnames: [["Rossi","罗西"],["Russo","鲁索"],["Ferrari","费拉里"],["Esposito","埃斯波西托"],["Bianchi","比安基"],["Romano","罗马诺"],["Colombo","科伦坡"],["Ricci","里奇"],["Marino","马里诺"],["Greco","格雷科"],["Moretti","莫雷蒂"],["Ferraro","费拉罗"],["Conti","孔蒂"],["Bruno","布鲁诺"]],
      gm: [["Matteo","马泰奥"],["Francesco","弗朗切斯科"],["Lorenzo","洛伦佐"],["Alessandro","亚历山德罗"],["Andrea","安德烈亚"],["Leonardo","莱昂纳多"],["Gabriele","加布里埃莱"],["Tommaso","托马索"],["Marco","马尔科"],["Luca","卢卡"],["Giulio","朱利奥"],["Dante","但丁"],["Emilio","埃米利奥"],["Gaius","盖乌斯"],["Lucius","卢基乌斯"],["Marcus","马尔库斯"]],
      gf: [["Giulia","朱莉娅"],["Sofia","索菲娅"],["Aurora","奥萝拉"],["Chiara","基娅拉"],["Francesca","弗朗切斯卡"],["Martina","玛蒂娜"],["Serena","塞雷娜"],["Valentina","瓦伦蒂娜"],["Elena","埃莱娜"],["Lucia","露琪娅"],["Bianca","比安卡"],["Camilla","卡米拉"],["Vittoria","维多利亚"],["Livia","莉薇娅"],["Octavia","屋大维娅"]]
    },
    celtic: {
      surnames: [["O'Brien","奥布莱恩"],["Murphy","墨菲"],["Kelly","凯利"],["O'Connor","奥康纳"],["Walsh","沃尔什"],["Lynch","林奇"],["Fitzgerald","菲茨杰拉尔德"],["Gallagher","加拉格尔"],["Doherty","多尔蒂"],["Kennedy","肯尼迪"],["Pendragon","潘德拉贡"],["Emrys","埃姆里斯"],["Gwynedd","格温内思"]],
      gm: [["Aengus","安格斯"],["Cian","基安"],["Fionn","菲恩"],["Oisín","奥辛"],["Ciarán","夏兰"],["Liam","利亚姆"],["Niall","尼尔"],["Eoin","欧文"],["Declan","德克兰"],["Ronan","罗南"],["Tadhg","泰格"],["Merlin","梅林"],["Taliesin","塔列辛"],["Gwydion","格维迪恩"],["Rhys","里斯"],["Dylan","迪伦"],["Llewellyn","卢埃林"],["Bran","布兰"]],
      gf: [["Saoirse","西尔莎"],["Niamh","妮娅芙"],["Aoife","伊芙"],["Siobhán","西沃恩"],["Maeve","梅芙"],["Brigid","布里吉德"],["Deirdre","迪尔德丽"],["Enya","恩雅"],["Fiona","菲奥娜"],["Aisling","艾丝琳"],["Rhiannon","里安农"],["Branwen","布兰文"],["Ceridwen","塞丽德温"],["Elowen","埃洛温"],["Olwen","奥尔温"],["Morrigan","莫瑞甘"],["Siofra","希芙拉"]]
    }
  };
  const BILINGUAL_MODES = new Set(["kr","jp","de","ru","la","celtic"]);
  const CULT_MODES = new Set(["kr","jp","hk","mo","tw","de","ru","la","celtic"]);
  const MODE_LABEL = { cn:"中文人名", en:"英语名字", nick:"中文昵称", kr:"韩国名字", jp:"日本名字", hk:"香港名字（粤语圈）", mo:"澳门名字（中葡生态）", tw:"台湾名字", de:"德语/北欧名字", ru:"俄语/斯拉夫名字", la:"拉丁语/意大利名字", celtic:"凯尔特/爱尔兰/威尔士名字" };

  function makeCultName(mode, opt) {
    const g0 = opt.gender === "all" || opt.gender === "neutral" ? pick(["male","female"]) : opt.gender;
    const banned = s => hitBanWord(s) || hitBanChar(s);
    if (mode === "kr" || mode === "jp") {
      const C = NAME_CULT[mode], s = pick(C.surnames), gv = pick(g0 === "male" ? C.gm : C.gf);
      const out = `${s[0]}${gv[0]}（${s[1]}${gv[1]}）`;
      return banned(out) ? "" : out;
    }
    if (mode === "tw") {
      const C = NAME_CULT.tw, out = pick(C.surnames) + pick(g0 === "male" ? C.gm : C.gf);
      return banned(out) ? "" : out;
    }
    if (mode === "hk" || mode === "mo") {
      // 澳门：部分生成土生葡人名字（原文+中文），其余为粤拼生态中文名
      if (mode === "mo" && Math.random() < 0.4) {
        const C = NAME_CULT.pt, gv = pick(g0 === "male" ? C.gm : C.gf), sur = pick(C.surnames);
        const out = `${gv[0]} ${sur[0]}（${gv[1]}·${sur[1]}）`;
        return banned(out) ? "" : out;
      }
      const C = NAME_CULT.hk, s = pick(mode === "mo" ? NAME_CULT.mo.surnames : C.surnames);
      const pool = g0 === "male" ? C.gm : C.gf;
      const n = Math.random() < 0.25 ? 1 : 2;
      let ch = s[0], rom = s[1], used = new Set(), chars = [];
      while (chars.length < n) { const c = pick(pool); if (used.has(c[0])) continue; used.add(c[0]); chars.push(c); }
      ch += chars.map(c => c[0]).join("");
      rom += " " + chars.map(c => c[1]).join(" ");
      const out = `${ch}（${rom}）`;
      return banned(out) ? "" : out;
    }
    // 西方小语种：原文 + 中文对照（俄语姓氏随性别变形）
    const C = NAME_CULT[mode], gv = pick(g0 === "male" ? C.gm : C.gf);
    let sur;
    if (mode === "ru") { const x = pick(C.surnames); sur = g0 === "male" ? [x[0], x[2]] : [x[1], x[3]]; }
    else sur = pick(C.surnames);
    const out = `${gv[0]} ${sur[0]}（${gv[1]}·${sur[1]}）`;
    return banned(out) ? "" : out;
  }

  function getLexicon(){
    const extra=getLS(LS.lex,null);
    if(!extra) return structuredClone(baseLex);
    const L=structuredClone(baseLex);
    const merge=(a,b)=>[...new Set([...(a||[]),...(b||[])])];
    try{
      if(extra.surnamePacks) for(const k of Object.keys(extra.surnamePacks)) L.surnamePacks[k]=merge(L.surnamePacks[k]||[],extra.surnamePacks[k]||[]);
      if(extra.doubleSurnames) L.doubleSurnames=merge(L.doubleSurnames,extra.doubleSurnames);
      if(extra.chars) for(const g of Object.keys(extra.chars)){ L.chars[g]=L.chars[g]||{}; for(const s of Object.keys(extra.chars[g])) L.chars[g][s]=merge(L.chars[g][s]||[],extra.chars[g][s]||[]); }
      if(extra.worldviewBoost) for(const w of Object.keys(extra.worldviewBoost)) L.worldviewBoost[w]=merge(L.worldviewBoost[w]||[],extra.worldviewBoost[w]||[]);
      if(extra.enFirst) for(const g of Object.keys(extra.enFirst)) L.enFirst[g]=merge(L.enFirst[g]||[],extra.enFirst[g]||[]);
      if(extra.enLast) for(const p of Object.keys(extra.enLast)) L.enLast[p]=merge(L.enLast[p]||[],extra.enLast[p]||[]);
      if(extra.nickCore) L.nickCore=merge(L.nickCore,extra.nickCore);
    }catch{}
    return L;
  }

  // ===== 黑名单 =====
  const banDefault={chars:[],words:[],surnames:[]};
  function getBan(){ return getLS(LS.ban, structuredClone(banDefault)); }
  function saveBan(b){ setLS(LS.ban,b); }
  function hitBanWord(s){ const b=getBan(), t=String(s||""); return b.words.some(w=>w && t.includes(w)); }
  function hitBanChar(s){ const b=getBan(), t=String(s||""); return b.chars.some(c=>c && t.includes(c)); }

  function renderBan(){
    const b=getBan();
    const draw=(id,type,list)=>{
      const box=$(id);
      if(!list.length){ box.innerHTML=`<span class="small">（空）</span>`; return; }
      box.innerHTML=list.map(v=>`<span class="glass-chip">${v}<button class="glass-btn" data-t="${type}" data-v="${v}">释放</button></span>`).join("");
      box.querySelectorAll("button[data-t]").forEach(btn=>{
        btn.onclick=()=>{
          const bb=getBan();
          bb[btn.dataset.t]=bb[btn.dataset.t].filter(x=>x!==btn.dataset.v);
          saveBan(bb); renderBan(); setTip(`已释放：${btn.dataset.v}`);
        };
      });
    };
    draw("banCharList","chars",b.chars);
    draw("banWordList","words",b.words);
    draw("banSurnameList","surnames",b.surnames);
  }

  // ===== 命名核心 =====
  const ziMap={"清":["怀瑾","子澄","景和"],"宁":["安之","知远","怀安"],"言":["子言","慎言","知言"],"昭":["明德","景明","昭远"],"澄":["清和","子澄","明澄"],"岚":["云起","景岚","怀岚"],"曜":["景曜","明远","曜之"],"瑾":["怀瑾","子瑜","景瑜"],"霁":["清霁","雨和","景霁"],"羽":["凌云","子羽","云程"],"舟":["行远","载川","子舟"],"文":["子文","文远","景文"]};
  const ziFallback={male:["子衡","子谦","怀瑾","景行","叔明","敬之","元白","清和","伯言","修远","允执","昭远","知安"],female:["令仪","清妍","静姝","若芷","怀柔","昭华","清音","知微","雅和","婉清","映雪","若宁"],neutral:["子言","知行","清和","怀安","若水","明远","景和","元宁","闻溪","知微","予安"]};

  function validSurnameInput(s){ return /^[\u4e00-\u9fa5]{1,2}$/.test(s); }

  function styleResolved(style,era){
    if(style!=="all") return style;
    if(era==="ancient") return "ancient";
    if(era==="republic") return "republic";
    if(era==="modern") return "modern";
    return pick(["ancient","modern","republic","fantasy"]);
  }

  function pickSurname(lex,opt){
    const ban=getBan();
    if(opt.lockSurname && validSurnameInput(opt.fixedSurname)){
      if(ban.surnames.includes(opt.fixedSurname)) return null;
      return opt.fixedSurname;
    }
    let pool=(lex.surnamePacks[opt.surnamePack]||lex.surnamePacks.common||[]).filter(s=>!ban.surnames.includes(s));
    if(!pool.length) return null;
    if((opt.era==="ancient"||opt.era==="republic") && Math.random()<0.1){
      const ds=(lex.doubleSurnames||[]).filter(s=>!ban.surnames.includes(s));
      if(ds.length) return pick(ds);
    }
    return pick(pool);
  }

  function weightedPool(lex,base,worldview){
    const boost=(lex.worldviewBoost[worldview]||[]);
    return [...base,...boost,...boost];
  }

  function pickZi(gender,given){
    for(const c of given){ if(ziMap[c]) return pick(ziMap[c]); }
    const g=gender==="all"?pick(["male","female","neutral"]):gender;
    return pick(ziFallback[g]);
  }

  function cnNameScore(full){
    const pure=String(full||"").replace(/（字[^）]+）/g,"");
    const m=pure.match(/^([\u4e00-\u9fa5]{1,2})([\u4e00-\u9fa5]{1,2})$/);
    if(!m) return 0;
    let s=74;
    const giv=m[2];
    if(giv.length===2) s+=10; else s+=3;
    if(/(.)\1/.test(giv)) s-=5;
    if(/[之也乎者]/.test(giv)) s-=6;
    if(/[机核栈阈模频矩熵铆铜轮]/.test(giv)) s-=22;
    if(hitBanWord(full)||hitBanChar(full)) s=0;
    return Math.max(0,Math.min(100,s));
  }

  function makeCnName(lex,opt){
    const g=opt.gender==="all"?pick(["male","female","neutral"]):opt.gender;
    const st=styleResolved(opt.style,opt.era);
    const base=(lex.chars[g]&&lex.chars[g][st])?lex.chars[g][st]:(lex.chars[g].modern||[]);
    const ban=getBan();

    let pool=weightedPool(lex,base,opt.worldview).filter(ch=>!ban.chars.includes(ch) && !ban.words.includes(ch));
    if(!pool.length) return "";

    const sur=pickSurname(lex,opt);
    if(!sur) return "";

    const len=Math.random()<0.2?1:2;
    let a=pick(pool), b=pick(pool), k=0;
    while(a===b && k<8){ b=pick(pool); k++; }

    if(opt.familyMode && len===2){
      if(/^[\u4e00-\u9fa5]$/.test(opt.generationChar||"")) b=opt.generationChar;
      else{
        const gp=["之","文","景","承","明","远","安","宁","清","昭","云","和","知","怀","子","令","元","若","行","志"].filter(x=>!ban.chars.includes(x));
        if(gp.length) b=pick(gp);
      }
    }

    const giv=len===1?a:(a+b);
    let full=sur+giv;
    if(opt.withZi && (opt.era==="ancient"||opt.era==="republic")) full+=`（字${pickZi(g,giv)}）`;
    if(hitBanWord(full)||hitBanChar(full)) return "";
    return full;
  }

  function makeEnName(lex,opt){
    const g=opt.gender==="all"?pick(["male","female","neutral"]):opt.gender;
    const first=pick((lex.enFirst[g]||[]).length?lex.enFirst[g]:baseLex.enFirst[g]);
    let out=first;
    if(opt.enWithSurname){
      let pack=opt.enLastPack||"common";
      if(opt.worldview==="western") pack="western";
      if(opt.worldview==="steam") pack="steam";
      if(opt.worldview==="cyberpunk") pack="cyberpunk";
      const pool=(lex.enLast[pack]||lex.enLast.common||[]);
      out=`${first} ${pick(pool)}`;
    }
    return hitBanWord(out)?"":out;
  }

  function makeNick(lex){
    const core=pick(lex.nickCore||baseLex.nickCore);
    const tails=["宝","崽","酱","儿","咪"];
    const r=Math.random();
    const n=r<0.45?core+core:(r<0.7?"小"+core:(r<0.9?"阿"+core:core+pick(tails)));
    return (hitBanWord(n)||hitBanChar(n))?"":n;
  }

  function cnToEnSeed(cn){
    const m={"刘":"Liu","王":"Wang","李":"Li","张":"Zhang","陈":"Chen","杨":"Yang","赵":"Zhao","黄":"Huang","周":"Zhou","吴":"Wu","清":"Qing","宁":"Ning","昭":"Zhao","岚":"Lan","澄":"Cheng","言":"Yan","安":"An","祈":"Qi","棠":"Tang","曜":"Yao","汐":"Xi","文":"Wen"};
    const out=[]; for(const c of (cn||"")) if(m[c]) out.push(m[c]); return out.join(" ");
  }

  function deriveEnNickFromResult(list){
    const out=[];
    list.forEach(n=>{
      const pure=n.replace(/（字[^）]+）/g,"");
      const seed=cnToEnSeed(pure);
      let x="";
      if(seed){
        const p=seed.split(/\s+/).filter(Boolean);
        const h=p[0]||"Kai";
        x=Math.random()<0.5?h:(h+"y");
      }else{
        x=pick(["Kay","Nia","Lio","Ari","Mio","Rin","Noa","Kiki","Lulu","Nini","Coco"]);
      }
      out.push(x);
    });
    return [...new Set(out)];
  }

  function dedupeWindow(str){ return str==="weak"?60:(str==="strong"?240:140); }

  function uniqRecent(names,strength){
    const win=dedupeWindow(strength), recent=getLS(LS.recent,[]);
    const set=new Set(recent.slice(-win));
    const out=[];
    for(const n of names){ if(!set.has(n)){ out.push(n); set.add(n);} }
    setLS(LS.recent,[...recent,...out].slice(-300));
    return out;
  }

  function checkCollision(name){
    const fav=getLS(LS.fav,[]), his=getLS(LS.his,[]);
    return fav.some(f=>f.name===name) || his.some(h=>(h.names||[]).includes(name));
  }

  // ===== AI =====
  async function aiGenerate(opt){
    const cfg=APIConfig.getActive();
    if(!cfg.base_url || !cfg.api_key || !cfg.model) return null;

    const b=getBan();
    const banDesc=`字黑名单:${b.chars.join("、")||"无"}；词黑名单:${b.words.join("、")||"无"}；姓氏黑名单:${b.surnames.join("、")||"无"}`;
    const modeText = MODE_LABEL[opt.mode]||"名字";
    const worldTxt = (opt.customWorldText||"").trim() || "无";
    const surRule=(opt.mode==="cn"&&opt.lockSurname&&validSurnameInput(opt.fixedSurname))?`姓氏固定为“${opt.fixedSurname}”。`:"";
    const ziRule=(opt.mode==="cn"&&opt.withZi&&(opt.era==="ancient"||opt.era==="republic"))?"可输出格式：张三（字某某）。":"";
    const enRule=(opt.mode==="en"&&opt.enWithSurname)?"英文名必须是 First Last。":"";
    const bilingualRule=(BILINGUAL_MODES.has(opt.mode)||opt.mode==="mo")?"每个名字必须是“原文全名（中文译名）”格式，括号内为中文对照，一行一个。":"";
    const regionalRule=opt.mode==="hk"?"使用香港繁体中文姓氏与粤语圈常用名字，括号内给粤语拼音，如 陳大文（Chan Tai Man）。":opt.mode==="mo"?"贴合澳门生态：粤拼中文名（括号粤语拼音）或土生葡人名字（原文+中文译名）。":opt.mode==="tw"?"使用台湾繁体中文名字，不加拼音。":opt.mode==="kr"?"使用韩文原名，括号内为标准中文译名。":opt.mode==="jp"?"使用日文原名（汉字/假名），括号内为中文译名。":"";

    const prompt=`输出${opt.batchCount}个${modeText}，每行一个，不编号不解释。
风格:${opt.style}；世界观预设:${opt.worldview}；自定义世界观:${worldTxt}；时代:${opt.era}；性别:${opt.gender}。
规则：真实可用、禁止机器感。${surRule}${ziRule}${enRule}${bilingualRule}${regionalRule}
必须遵守黑名单：${banDesc}`;

    const payload={
      model:cfg.model,
      temperature:Number(cfg.temperature||0.75),
      max_tokens:900,
      messages:[
        {role:"system",content:"你是命名助手，只返回名字列表，不解释。"},
        {role:"user",content:prompt}
      ]
    };

    // 取名器结果为短列表：统一收集完整响应后一次性解析（非流式）
    try{
      const txt=await fetchChat(cfg.base_url,cfg.api_key,payload);
      if(txt){
        let arr=txt.split(/\n+/).map(s=>s.replace(/^\d+[\.\、\s]*/,"").trim()).filter(Boolean);
        arr=arr.filter(x=>!hitBanWord(x)&&!hitBanChar(x));
        if(arr.length) return arr;
      }
    }catch{}
    return null;
  }

  // ===== 收藏系统 =====
  function getGroups(){ return getLS(LS.groups,["默认"]); }
  function setGroups(g){ setLS(LS.groups,[...new Set(g)].filter(Boolean)); }
  function renderGroupSelects(){
    const groups=getGroups();
    const opts=groups.map(g=>`<option value="${g}">${g}</option>`).join("");
    $("favGroupSelect").innerHTML=opts;
    $("viewGroupFilter").innerHTML=`<option value="all">全部</option>${opts}`;
  }

  function addFav(name,group,tags){
    const fav=getLS(LS.fav,[]);
    if(fav.some(x=>x.name===name)) return;
    fav.unshift({name,group:group||"默认",tags:tags||[],time:now()});
    setLS(LS.fav,fav.slice(0,600));
    renderFav();
  }
  function delFav(name){
    setLS(LS.fav,getLS(LS.fav,[]).filter(x=>x.name!==name));
    renderFav();
  }

  function renderFav(){
    const fav=getLS(LS.fav,[]);
    const gf=$("viewGroupFilter").value||"all";
    const tf=($("viewTagFilter").value||"").trim();
    const list=fav.filter(f=>(gf==="all"||f.group===gf)&&(!tf||(f.tags||[]).includes(tf)));
    if(!list.length){ favList.innerHTML=`<div class="glass-item small">（暂无收藏）</div>`; return; }

    favList.innerHTML=list.map(f=>`
      <div class="glass-item row" style="justify-content:space-between">
        <div>
          <div class="name" style="font-size:18px">${f.name}</div>
          <div class="small">分组：${f.group} ${(f.tags||[]).map(t=>`<span class="glass-tag">${t}</span>`).join("")}</div>
        </div>
        <div class="row">
          <button class="glass-btn" data-c="${f.name}">复制</button>
          <button class="glass-btn" data-d="${f.name}">移除</button>
        </div>
      </div>
    `).join("");

    favList.querySelectorAll("button[data-c]").forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.c); setTip("已复制");});
    favList.querySelectorAll("button[data-d]").forEach(b=>b.onclick=()=>delFav(b.dataset.d));
  }

  function renderHistory(){
    const his=getLS(LS.his,[]);
    if(!his.length){ hisList.innerHTML=`<div class="glass-item small">（暂无历史）</div>`; return; }
    hisList.innerHTML=his.map(h=>`
      <div class="glass-item">
        <div class="small">${h.time} · ${h.mode} · ${h.style} · ${h.worldview} · ${h.era} · ${h.gender} ${h.ai?"·AI":""}</div>
        <div>${h.names.join(" / ")}</div>
      </div>
    `).join("");
  }
  function pushHistory(h){
    const his=getLS(LS.his,[]);
    his.unshift(h);
    setLS(LS.his,his.slice(0,240));
    renderHistory();
  }

  function collectOpt(){
    return {
      mode:$("mode").value,
      engine:$("engine").value,
      style:$("style").value,
      worldview:$("worldview").value,
      era:$("era").value,
      gender:$("gender").value,
      displayCount:Number($("displayCount").value),
      batchCount:Number($("batchCount").value),
      dedupeStrength:$("dedupeStrength").value,
      scoreThreshold:Number($("scoreThreshold").value),
      withZi:$("withZi").checked,
      surnamePack:$("surnamePack").value,
      fixedSurname:$("fixedSurname").value.trim(),
      lockSurname:$("lockSurname").checked,
      enWithSurname:$("enWithSurname").checked,
      enLastPack:$("enLastPack").value,
      familyMode:$("familyMode").checked,
      generationChar:$("generationChar").value.trim(),
      tempExcludeChars:$("tempExcludeChars").value.trim(),
      tempExcludeWords:$("tempExcludeWords").value.trim(),
      customWorldText:$("customWorldText").value.trim(),
      cnRefForEn:$("cnRefForEn").value.trim()
    };
  }

  function validateOpt(o){
    if(o.lockSurname && !validSurnameInput(o.fixedSurname)) return "固定姓氏需1-2中文字符";
    if(o.generationChar && !/^[\u4e00-\u9fa5]$/.test(o.generationChar)) return "辈分字必须1个中文字符";
    return "";
  }

  function makeBatchLocal(opt){
    const lex=getLexicon();
    const out=[];
    let guard=0;
    while(out.length<opt.batchCount && guard<2500){
      guard++;
      let n="";
      if(opt.mode==="cn"){
        n=makeCnName(lex,opt);
        if(!n) continue;
        if(hitTempExclude(n,opt.tempExcludeChars,opt.tempExcludeWords)) continue;
      }else if(opt.mode==="nick"){
        n=makeNick(lex);
      }else if(opt.mode==="en"){
        if(opt.cnRefForEn && Math.random()<0.2){
          const seed=cnToEnSeed(opt.cnRefForEn);
          if(seed) n=opt.enWithSurname ? `${seed} ${pick((lex.enLast[opt.enLastPack]||lex.enLast.common))}` : seed.split(" ")[0];
        }
        if(!n) n=makeEnName(lex,opt);
      }else if(CULT_MODES.has(opt.mode)){
        n=makeCultName(opt.mode,opt);
      }
      if(!n) continue;
      if(!hitBanWord(n) && !hitBanChar(n) && !out.includes(n)) out.push(n);
    }
    return out;
  }

  function rankAndSelect(opt,batch){
    let rows=batch.map(n=>{
      let s=80;
      if(opt.mode==="cn") s=cnNameScore(n);
      else if(opt.mode==="en") s=/^[A-Za-z][A-Za-z'\-]+(\s+[A-Za-z][A-Za-z'\-]+)?$/.test(n)?84:48;
      else if(opt.mode==="nick") s=n.length<=4?82:64;
      else if(opt.mode==="hk"||opt.mode==="mo") s=/^[\u4e00-\u9fa5]{2,6}（[A-Za-z .'-]+）$/.test(n)?84:(/（[^（）]*[\u4e00-\u9fa5][^（）]*）\s*$/.test(n)?84:46);
      else if(BILINGUAL_MODES.has(opt.mode)) s=/（[^（）]*[\u4e00-\u9fa5][^（）]*）\s*$/.test(n)?84:46;
      else if(opt.mode==="tw") s=/^[\u4e00-\u9fa5]{2,5}$/.test(n)?84:50;
      else if(CULT_MODES.has(opt.mode)) s=80;
      if(checkCollision(n)) s-=6;
      if(hitBanWord(n)||hitBanChar(n)) s=0;
      return {name:n,score:s,collision:checkCollision(n)};
    });

    let thr=opt.scoreThreshold;
    let selected=[];
    while(thr>=50){
      selected=rows.filter(r=>r.score>=thr);
      if(selected.length>=opt.displayCount) break;
      thr-=3;
    }
    if(thr<opt.scoreThreshold) setTip(`高分不足，阈值自动降至 ${thr}`);

    selected.sort((a,b)=>b.score-a.score);
    const deduped=uniqRecent(selected.map(x=>x.name),opt.dedupeStrength);
    return deduped.slice(0,opt.displayCount).map(n=>selected.find(x=>x.name===n)).filter(Boolean);
  }

  function renderResults(rows){
    if(!rows.length){ resultList.innerHTML=`<div class="glass-item small">（无可展示结果，请放宽条件）</div>`; return; }
    resultList.innerHTML=rows.map(r=>`
      <div class="glass-item row" style="justify-content:space-between">
        <div>
          <div class="name">${r.name}</div>
          <div class="small">质量：${r.score}${r.collision?` <span class="warn">可能重名</span>`:""}</div>
        </div>
        <div class="row">
          <button class="glass-btn" data-c="${r.name}">复制</button>
          <button class="glass-btn" data-f="${r.name}">收藏</button>
        </div>
      </div>
    `).join("");

    resultList.querySelectorAll("button[data-c]").forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.c); setTip("已复制");});
    resultList.querySelectorAll("button[data-f]").forEach(b=>b.onclick=()=>{
      const group=$("favGroupSelect").value||"默认";
      const tags=($("favTagsInput").value||"").split(/[，,]/).map(x=>x.trim()).filter(Boolean);
      addFav(b.dataset.f,group,tags); setTip("已收藏");
    });
  }

  async function generateFlow(){
    const opt=collectOpt();
    const err=validateOpt(opt);
    if(err) return setTip(err);

    setLS(LS.opts,{
      surnamePack:opt.surnamePack,fixedSurname:opt.fixedSurname,lockSurname:opt.lockSurname,
      enWithSurname:opt.enWithSurname,enLastPack:opt.enLastPack
    });

    UX.loading("取名生成中…");
    let batch=[], usedAI=false;

    const apiReady=(()=>{const c=APIConfig.getActive(); return !!(c.base_url&&c.api_key&&c.model)})();
    const shouldAI = (opt.engine==="ai") || (opt.engine==="auto" && apiReady && (opt.worldview!=="all" || opt.customWorldText || CULT_MODES.has(opt.mode)));

    if(shouldAI){
      const ai=await aiGenerate(opt);
      if(ai && ai.length){
        const local=makeBatchLocal(opt);
        const aiTake=Math.max(1,Math.floor(opt.batchCount*0.35));
        batch=[...ai.slice(0,aiTake), ...local].slice(0,opt.batchCount);
        usedAI=true;
      }
    }
    if(!batch.length) batch=makeBatchLocal(opt);

    const finalRows=rankAndSelect(opt,batch);
    renderResults(finalRows);

    pushHistory({
      time:now(), mode:opt.mode, style:opt.style, worldview:opt.worldview, era:opt.era, gender:opt.gender,
      ai:usedAI, names:finalRows.map(x=>x.name)
    });

    UX.done(); setTip(usedAI?"完成（AI+本地）":"完成（本地）");
  }

  // ===== 事件 =====
  $("btnGenName").onclick=generateFlow;
  $("btnClearResultName").onclick=()=> resultList.innerHTML=`<div class="glass-item small">（结果已清空）</div>`;

  $("btnCopyAll").onclick=async()=>{
    const names=[...resultList.querySelectorAll(".name")].map(x=>x.textContent.trim()).filter(Boolean);
    if(!names.length) return setTip("没有可复制内容");
    await navigator.clipboard.writeText(names.join("\n"));
    setTip("已复制全部");
  };

  $("btnSaveAllFav").onclick=()=>{
    const names=[...resultList.querySelectorAll(".name")].map(x=>x.textContent.trim()).filter(Boolean);
    if(!names.length) return setTip("没有可收藏内容");
    const group=$("favGroupSelect").value||"默认";
    const tags=($("favTagsInput").value||"").split(/[，,]/).map(x=>x.trim()).filter(Boolean);
    names.forEach(n=>addFav(n,group,tags));
    setTip("已全部收藏");
  };

  $("btnClearFav").onclick=()=>{ if(confirm("清空收藏？")){ setLS(LS.fav,[]); renderFav(); } };
  $("btnClearHis").onclick=()=>{ if(confirm("清空历史？")){ setLS(LS.his,[]); renderHistory(); } };

  // 分组
  $("btnAddGroup").onclick=()=>{
    const n=($("newGroupInput").value||"").trim();
    if(!n) return;
    const g=getLS(LS.groups,["默认"]);
    if(!g.includes(n)) g.push(n);
    setLS(LS.groups,g); renderGroupSelects(); $("newGroupInput").value="";
    setTip("分组已新增");
  };

  $("btnDelGroup").onclick=()=>{
    const cur=$("favGroupSelect").value;
    if(cur==="默认") return setTip("默认分组不可删除");
    const g=getLS(LS.groups,["默认"]).filter(x=>x!==cur);
    setLS(LS.groups,g);
    const fav=getLS(LS.fav,[]).map(f=>f.group===cur?({...f,group:"默认"}):f);
    setLS(LS.fav,fav);
    renderGroupSelects(); renderFav(); setTip("分组已删除");
  };

  $("viewGroupFilter").onchange=renderFav;
  $("viewTagFilter").oninput=renderFav;

  // 黑名单
  $("btnAddBanChar").onclick=()=>{
    const v=($("banCharInput").value||"").trim();
    if(!/^[\u4e00-\u9fa5]$/.test(v)) return setTip("字黑名单需1个中文字符");
    const b=getBan(); if(!b.chars.includes(v)) b.chars.push(v); saveBan(b);
    $("banCharInput").value=""; renderBan(); setTip("已拉黑字");
  };
  $("btnAddBanWord").onclick=()=>{
    const v=($("banWordInput").value||"").trim();
    if(!v) return;
    const b=getBan(); if(!b.words.includes(v)) b.words.push(v); saveBan(b);
    $("banWordInput").value=""; renderBan(); setTip("已拉黑词");
  };
  $("btnAddBanSurname").onclick=()=>{
    const v=($("banSurnameInput").value||"").trim();
    if(!/^[\u4e00-\u9fa5]{1,2}$/.test(v)) return setTip("姓氏黑名单需1-2中文字符");
    const b=getBan(); if(!b.surnames.includes(v)) b.surnames.push(v); saveBan(b);
    $("banSurnameInput").value=""; renderBan(); setTip("已拉黑姓");
  };
  $("btnClearBan").onclick=()=>{ if(confirm("清空黑名单？")){ saveBan(structuredClone(banDefault)); renderBan(); setTip("黑名单已清空"); } };

  $("btnExportBan").onclick=()=>downloadJSON("blacklist.json",getBan());
  $("btnImportBan").onclick=()=>{
    const f=$("importBanFile").files?.[0];
    if(!f) return setTip("先选JSON文件");
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const o=JSON.parse(String(rd.result||"{}"));
        const b=getBan();
        b.chars=[...new Set([...(b.chars||[]), ...((o.chars||[]).filter(x=>/^[\u4e00-\u9fa5]$/.test(x)))])];
        b.words=[...new Set([...(b.words||[]), ...((o.words||[]).map(x=>String(x).trim()).filter(Boolean))])];
        b.surnames=[...new Set([...(b.surnames||[]), ...((o.surnames||[]).filter(x=>/^[\u4e00-\u9fa5]{1,2}$/.test(x)))])];
        saveBan(b); renderBan(); setTip("黑名单导入成功");
      }catch{ setTip("黑名单JSON格式错误"); }
    };
    rd.readAsText(f,"utf-8");
  };

  // 词库包
  $("btnExportLexicon").onclick=()=>downloadJSON("lexicon_pack.json",getLexicon());
  $("btnImportLexicon").onclick=()=>{
    const f=$("importLexiconFile").files?.[0];
    if(!f) return setTip("先选JSON文件");
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const obj=JSON.parse(String(rd.result||"{}"));
        const cur=getLS(LS.lex,{});
        setLS(LS.lex,Object.assign({},cur,obj));
        setTip("词库包导入成功（已追加）");
      }catch{ setTip("词库包JSON格式错误"); }
    };
    rd.readAsText(f,"utf-8");
  };

  // 英文派生昵称
  $("btnEnDerive").onclick=()=>{
    const names=[...resultList.querySelectorAll(".name")].map(x=>x.textContent.trim()).filter(Boolean);
    if(!names.length) return setTip("先生成名字");
    const nick=deriveEnNickFromResult(names);
    resultList.innerHTML=nick.map(n=>`
      <div class="glass-item row" style="justify-content:space-between">
        <div class="name">${n}</div>
        <div class="row"><button class="glass-btn" data-c="${n}">复制</button><button class="glass-btn" data-f="${n}">收藏</button></div>
      </div>
    `).join("");
    resultList.querySelectorAll("button[data-c]").forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.c); setTip("已复制");});
    resultList.querySelectorAll("button[data-f]").forEach(b=>b.onclick=()=>{
      const group=$("favGroupSelect").value||"默认";
      const tags=($("favTagsInput").value||"").split(/[，,]/).map(x=>x.trim()).filter(Boolean);
      addFav(b.dataset.f,group,tags); setTip("已收藏");
    });
    setTip("已生成英文派生昵称");
  };

  // reset
  $("btnResetAll").onclick=()=>{
    if(!confirm("恢复默认（不清空收藏/历史），继续？")) return;
    $("mode").value="cn"; $("engine").value="auto"; $("style").value="all"; $("worldview").value="all"; $("era").value="all"; $("gender").value="all";
    $("displayCount").value="5"; $("batchCount").value="30"; $("dedupeStrength").value="mid"; $("scoreThreshold").value="65";
    $("withZi").checked=false;
    $("surnamePack").value="common"; $("fixedSurname").value=""; $("lockSurname").checked=false;
    $("enWithSurname").checked=false; $("enLastPack").value="common"; $("familyMode").checked=false; $("generationChar").value="";
    $("tempExcludeChars").value=""; $("tempExcludeWords").value=""; $("customWorldText").value=""; $("cnRefForEn").value="";
    setTip("已恢复默认");
  };

  function downloadJSON(name,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"});
    const u=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u);
  }

  function renderGroupSelects(){
    const groups=getLS(LS.groups,["默认"]);
    if(!groups.length) setLS(LS.groups,["默认"]);
    const gs=getLS(LS.groups,["默认"]);
    const opts=gs.map(g=>`<option value="${g}">${g}</option>`).join("");
    $("favGroupSelect").innerHTML=opts;
    $("viewGroupFilter").innerHTML=`<option value="all">全部</option>${opts}`;
  }

  function init(){
    if(!getLS(LS.groups,null)) setLS(LS.groups,["默认"]);
    const o=getLS(LS.opts,{});
    if(o.surnamePack) $("surnamePack").value=o.surnamePack;
    $("fixedSurname").value=o.fixedSurname||"";
    $("lockSurname").checked=!!o.lockSurname;
    $("enWithSurname").checked=!!o.enWithSurname;
    if(o.enLastPack) $("enLastPack").value=o.enLastPack;

    renderGroupSelects();
    renderBan();
    renderFav();
    renderHistory();
  }

  init();

  
}
