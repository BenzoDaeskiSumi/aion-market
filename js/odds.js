/* Aion 2 Market — official odds page (odds.html). Data: data/odds/*.json, NCSOFT's probability disclosure for the KOREAN
   service (scripts/odds_import.mjs). Korean terms are translated with the KO table below (Italian/English); item names with
   data/odds/ko_en.json (NCSOFT dictionary). Anything not translated stays in Korean. */
const $ = (id) => document.getElementById(id);
const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u))));
const EN_UI = LANG !== 'it';
// Korean -> [Italian, English]
const KO = {
  // categories
  '장비': ['Equipaggiamento', 'Equipment'], '장비 강화 확률': ['Potenziamento', 'Enhancement'], '특수 강화 확률': ['Potenziamento speciale', 'Special enhancement'],
  '마석/영석 확률': ['Manastone / Spirit stone', 'Manastone / Spirit stone'], '돌파 강화 확률': ['Breakthrough', 'Breakthrough'], '장비 계승 확률': ['Eredità dell\'equipaggiamento', 'Equipment inheritance'],
  '영혼 각인': ['Soul Engraving', 'Soul Engraving'], '영혼 각인 옵션 부여 확률': ['Opzioni di Soul Engraving', 'Soul Engraving options'], '무기': ['Armi', 'Weapons'], '방어구': ['Armature', 'Armor'],
  '장신구': ['Accessori', 'Accessories'], '펫 종족 이해도': ['Affinità dei pet', 'Pet affinity'], '히든 큐브': ['Hidden Cube', 'Hidden Cube'], '외형': ['Aspetto', 'Appearance'],
  '상자형 아이템': ['Forzieri e box', 'Boxes'], '신석 합성 확률': ['Sintesi Godstone', 'Godstone synthesis'], '물질변환': ['Substance Morph', 'Substance Morph'], '아르카나': ['Arcana', 'Arcana'],
  '아이템 추출': ['Estrazione oggetti', 'Item extraction'], '날개': ['Ali', 'Wings'], '제작': ['Crafting', 'Crafting'], '오드 에너지 큐브': ['Odd Energy Cube', 'Odd Energy Cube'],
  '몬스터 큐브': ['Monster Cube', 'Monster Cube'], '히든 큐브 확률(천족)': ['Hidden Cube (Elyos)', 'Hidden Cube (Elyos)'], '히든 큐브 확률(마족)': ['Hidden Cube (Asmodian)', 'Hidden Cube (Asmodian)'],
  // common columns
  '장비 카테고리': ['Categoria', 'Category'], '등급': ['Grado', 'Grade'], '장비 레벨': ['Livello equip.', 'Item level'], '강화 단계': ['Livello di potenziamento', 'Enhancement level'],
  '강화 확률': ['Probabilità', 'Chance'], '강화 실패 시 보정 확률': ['Bonus per ogni fallimento', 'Bonus per failure'], '강화 실패 시 패널티': ['Se fallisce', 'On failure'],
  '강화 필요 키나': ['Kinah', 'Kinah'], '강화 재료 이름1': ['Materiale 1', 'Material 1'], '강화 재료 수량1': ['Qtà 1', 'Qty 1'], '강화 재료 이름2': ['Materiale 2', 'Material 2'],
  '강화 재료 수량2': ['Qtà 2', 'Qty 2'], '강화 재료 이름3': ['Materiale 3', 'Material 3'], '강화 재료 수량3': ['Qtà 3', 'Qty 3'],
  '히든큐브명': ['Cubo', 'Cube'], '유형': ['Tipo', 'Type'], '종족': ['Razza', 'Race'], '구분': ['Tipo di ricompensa', 'Reward type'], '그룹': ['Gruppo', 'Group'], '그룹확률': ['Probabilità del gruppo', 'Group chance'],
  '확률 획득 수량': ['Estrazioni', 'Rolls'], '아이템명': ['Oggetto', 'Item'], '최소 수량': ['Min', 'Min'], '최대 수량': ['Max', 'Max'], '확률': ['Probabilità', 'Chance'],
  '합성 재료 등급': ['Grado dei materiali', 'Material grade'], '획득 신석 등급': ['Grado ottenuto', 'Result grade'], '등급 별 확률 합': ['Probabilità del grado', 'Grade chance'],
  '획득 신석 이름': ['Godstone ottenuta', 'Godstone'], '획득 확률': ['Probabilità', 'Chance'], '아이템 이름': ['Oggetto', 'Item'], '획득 아이템': ['Oggetto ottenuto', 'Result item'],
  '수량': ['Quantità', 'Quantity'], '옵션': ['Opzione', 'Option'], '옵션명': ['Opzione', 'Option'], '옵션 수치': ['Valore', 'Value'], '단계': ['Livello', 'Level'], '성공 확률': ['Successo', 'Success'],
  '대성공 확률': ['Combo / grande successo', 'Great success'], '실패 확률': ['Fallimento', 'Failure'], '레벨': ['Livello', 'Level'], '보상': ['Ricompensa', 'Reward'],
  // values
  '천족': ['Elyos', 'Elyos'], '마족': ['Asmodian', 'Asmodian'], '일반보상': ['Ricompensa normale', 'Normal reward'], '열쇠보상': ['Con la chiave', 'With key'], '유지': ['Resta', 'Kept'],
  '하락': ['Scende', 'Drops'], '파괴': ['Si distrugge', 'Destroyed'], '초기화': ['Si azzera', 'Reset'], '개별확률': ['Probabilità singola', 'Individual chance'],
  '일반': ['Common', 'Common'], '고급': ['Non rare', 'Uncommon'], '희귀': ['Rare', 'Rare'], '전승': ['Legendary', 'Legendary'], '유일': ['Unique', 'Unique'], '영웅': ['Epic', 'Epic'], '신화': ['Mythic', 'Mythic'],
  '대검': ['Greatsword', 'Greatsword'], '장검': ['Longsword', 'Longsword'], '단검': ['Dagger', 'Dagger'], '활': ['Bow', 'Bow'], '법서': ['Spellbook', 'Spellbook'], '보주': ['Orb', 'Orb'],
  '전곤': ['Mace', 'Mace'], '법봉': ['Staff', 'Staff'], '가더': ['Guard', 'Guard'], '투구': ['Helm', 'Helm'], '견갑': ['Pauldrons', 'Pauldrons'], '상의': ['Top', 'Top'], '하의': ['Legs', 'Legs'],
  '장갑': ['Gloves', 'Gloves'], '신발': ['Shoes', 'Shoes'], '망토': ['Cloak', 'Cloak'], '목걸이': ['Necklace', 'Necklace'], '귀걸이': ['Earrings', 'Earrings'], '반지': ['Ring', 'Ring'], '팔찌': ['Bracelet', 'Bracelet'],
  '키나': ['Kinah', 'Kinah'], '강화석': ['Enhancement Stone', 'Enhancement Stone'],
};

// more columns and values (translated by hand; skill names stay in Korean)
Object.assign(KO, Object.fromEntries([
  ['합성 재료 외형 등급', 'Grado aspetto usato', 'Material appearance grade'], ['획득 외형 등급', 'Grado ottenuto', 'Result grade'], ['행운의 기운 사용시 확률', 'Con Aura della fortuna', 'With Lucky Aura'],
  ['획득 외형명', 'Aspetto ottenuto', 'Result appearance'], ['스탯', 'Statistica', 'Stat'], ['수치', 'Valore', 'Value'], ['스탯명', 'Statistica', 'Stat'], ['수치 값', 'Valore', 'Value'],
  ['장비 종류', 'Tipo di equipaggiamento', 'Equipment type'], ['옵션 부여 수량', 'Opzioni assegnate', 'Options given'], ['최대 스킬 옵션 수량', 'Max opzioni skill', 'Max skill options'], ['직업', 'Classe', 'Class'],
  ['상자 이름', 'Box', 'Box'], ['보상 유형', 'Tipo di ricompensa', 'Reward type'], ['패키지 확률', 'Probabilità del pacchetto', 'Package chance'], ['개수', 'Quantità', 'Quantity'],
  ['구성 아이템 이름', 'Oggetto contenuto', 'Content item'], ['걍화단계', 'Potenziamento', 'Enhancement'], ['최소 개수', 'Min', 'Min'], ['최대 개수', 'Max', 'Max'], ['아이템 획득 확률', 'Probabilità', 'Chance'],
  ['물질변환 결과물', 'Risultato', 'Result'], ['결과물 강화 단계', 'Potenziamento risultato', 'Result enhancement'], ['결과물 수량', 'Quantità risultato', 'Result quantity'],
  ['실패 시 보상 확률', 'Probabilità ricompensa se fallisce', 'Reward chance on failure'], ['물질변환 대성공 결과물', 'Risultato con grande successo', 'Great success result'],
  ['대성공 결과물 강화 단계', 'Potenziamento (grande successo)', 'Enhancement (great success)'], ['대성공 결과물 수량', 'Quantità (grande successo)', 'Quantity (great success)'],
  ['실패 시 보상', 'Ricompensa se fallisce', 'Reward on failure'], ['실패 시 보상 결과물 강화 단계', 'Potenziamento (fallimento)', 'Enhancement (failure)'], ['실패 시 보상 결과물 수량', 'Quantità (fallimento)', 'Quantity (failure)'],
  ['종족 제한', 'Solo per', 'Race limit'], ['기간한정 시작일', 'Dal', 'From'], ['기간한정 종료일', 'Al', 'Until'], ['서버별 선착순 수량', 'Disponibili per server', 'Per-server stock'],
  ['서버별 제한 수량', 'Limite per server', 'Per-server limit'], ['캐릭터별 제한 수량', 'Limite per personaggio', 'Per-character limit'], ['제한 수량 초기화 주기', 'Reset del limite', 'Limit reset'],
  ['제작 결과 수량', 'Quantità prodotta', 'Crafted quantity'], ['콤보여부', 'Combo', 'Combo'], ['콤보확률', 'Probabilità combo', 'Combo chance'], ['페스타 이름', 'Festa', 'Festa'], ['레벨 구간', 'Fascia di livello', 'Level range'],
  ['그룹 확률', 'Probabilità del gruppo', 'Group chance'], ['슬롯', 'Slot', 'Slot'], ['확률 합', 'Totale', 'Total'], ['보상 형태', 'Tipo di ricompensa', 'Reward type'], ['묶음 보상 획득 확률', 'Probabilità del pacchetto', 'Bundle chance'],
  ['묶음 보상 수량', 'Quantità del pacchetto', 'Bundle quantity'], ['지급 아이템', 'Oggetto', 'Item'], ['아이템 최소 획득 수량', 'Min', 'Min'], ['아이템 최대 획득 수량', 'Max', 'Max'], ['옵션 최소 수량', 'Opzioni min', 'Min options'],
  ['옵션 최대 수량', 'Opzioni max', 'Max options'], ['옵션 종류', 'Opzione', 'Option'], ['옵션 부여 확률', 'Probabilità', 'Chance'], ['기본 레벨/수치', 'Livello/valore base', 'Base level/value'],
  ['강화 성공시 성장 레벨/수치', 'Crescita per potenziamento', 'Growth per enhancement'], ['최대 성장 레벨/수치', 'Livello/valore massimo', 'Max level/value'], ['던전명', 'Dungeon', 'Dungeon'],
  ['던전 난이도', 'Difficoltà', 'Difficulty'], ['던전 단계', 'Fase', 'Stage'], ['처치 대상', 'Boss / mostro', 'Target'], ['계승 종류', 'Tipo di eredità', 'Inheritance type'], ['누적 계승 횟수', 'Eredità fatte', 'Inheritances done'],
  ['계승 성공 확률', 'Successo', 'Success'], ['날개 이름', 'Ali', 'Wings'], ['목표 강화 레벨', 'Livello obiettivo', 'Target level'], ['기본 강화 확률', 'Probabilità base', 'Base chance'], ['최대 강화 확률', 'Probabilità massima', 'Max chance'],
  ['추가 강화 확률', 'Bonus per fallimento', 'Bonus per failure'], ['장비명', 'Equipaggiamento', 'Equipment'], ['기타', 'Altro', 'Other'], ['영혼 각인 수치 부여 확률', 'Valori di Soul Engraving', 'Soul Engraving values'],
  ['레벨별 획득 가능 옵션 등급 확률', 'Grado delle opzioni per livello', 'Option grade by level'], ['종족별 이해도 옵션 획득 확률', 'Opzioni per razza', 'Options by race'],
  ['외형 합성 확률(천족)', 'Sintesi aspetto (Elyos)', 'Appearance synthesis (Elyos)'], ['외형 합성 확률(마족)', 'Sintesi aspetto (Asmodian)', 'Appearance synthesis (Asmodian)'],
  ['날개 강화 확률', 'Potenziamento ali', 'Wings enhancement'], ['날개 강화 단계별 보유 효과', 'Effetti per livello delle ali', 'Wing effects by level'],
  // stats and classes (global names)
  ['치명타', 'Critical Hit', 'Critical Hit'], ['막기', 'Block', 'Block'], ['치명타 저항', 'Critical Hit Resist', 'Critical Hit Resist'], ['생명력', 'HP', 'HP'], ['정신력', 'MP', 'MP'], ['피해 증폭', 'Damage Boost', 'Damage Boost'],
  ['명중', 'Accuracy', 'Accuracy'], ['공격력', 'Attack', 'Attack'], ['무기 피해 증폭', 'Weapon Damage Boost', 'Weapon Damage Boost'], ['회피', 'Evasion', 'Evasion'], ['정신력 자연 회복', 'MP Regen', 'MP Regen'],
  ['생명력 자연 회복', 'HP Regen', 'HP Regen'], ['치명타 공격력', 'Critical Attack', 'Critical Attack'], ['치명타 방어력', 'Critical Defense', 'Critical Defense'], ['공통', 'Comune', 'Common'], ['방어력', 'Defense', 'Defense'],
  ['치명타 피해 증폭', 'Critical Damage Boost', 'Critical Damage Boost'], ['최대 공격력', 'Max Attack', 'Max Attack'], ['보스 공격력', 'Boss Attack', 'Boss Attack'], ['PVE 공격력', 'PvE Attack', 'PvE Attack'],
  ['PVE 방어력', 'PvE Defense', 'PvE Defense'], ['후방 공격력', 'Back Attack', 'Back Attack'], ['전방 공격력', 'Front Attack', 'Front Attack'], ['재생', 'Regeneration', 'Regeneration'], ['전방 방어력', 'Front Defense', 'Front Defense'],
  ['피해 내성', 'Damage Tolerance', 'Damage Tolerance'], ['완벽', 'Perfect', 'Perfect'], ['강타', 'Double', 'Double'], ['PVP 공격력', 'PvP Attack', 'PvP Attack'], ['PVP 방어력', 'PvP Defense', 'PvP Defense'],
  ['후방 피해 증폭', 'Back Damage Boost', 'Back Damage Boost'], ['전방 피해 증폭', 'Front Damage Boost', 'Front Damage Boost'], ['지식', 'Knowledge', 'Knowledge'], ['비행력', 'Flight', 'Flight'],
  ['추가 공격력', 'Additional Attack', 'Additional Attack'], ['보스 방어력', 'Boss Defense', 'Boss Defense'], ['전투 속도', 'Combat Speed', 'Combat Speed'], ['위력', 'Might', 'Might'], ['정확', 'Precision', 'Precision'],
  ['민첩', 'Dexterity', 'Dexterity'], ['체력', 'Constitution', 'Constitution'], ['의지', 'Willpower', 'Willpower'], ['지능', 'Intelligence', 'Intelligence'], ['상태이상 저항', 'Status Resist', 'Status Resist'],
  ['철벽', 'Endurance', 'Endurance'], ['후방 방어력', 'Back Defense', 'Back Defense'], ['받는 치유량', 'Healing Received', 'Healing Received'], ['치명타 피해 내성', 'Critical Damage Tolerance', 'Critical Damage Tolerance'],
  ['무기 피해 내성', 'Weapon Damage Tolerance', 'Weapon Damage Tolerance'], ['추가 명중', 'Additional Accuracy', 'Additional Accuracy'], ['추가 회피', 'Additional Evasion', 'Additional Evasion'],
  ['상태이상 적중', 'Status Accuracy', 'Status Accuracy'], ['다단 히트 적중', 'Multi-hit Accuracy', 'Multi-hit Accuracy'], ['막기 관통', 'Block Penetration', 'Block Penetration'], ['강타 저항', 'Double Resist', 'Double Resist'],
  ['완벽 저항', 'Perfect Resist', 'Perfect Resist'], ['철벽 관통', 'Endurance Penetration', 'Endurance Penetration'], ['재생 관통', 'Regeneration Penetration', 'Regeneration Penetration'], ['확정 부여', 'Garantito', 'Guaranteed'],
  ['치유량 증가', 'Healing Boost', 'Healing Boost'], ['이동 속도', 'Move Speed', 'Move Speed'], ['재사용 시간', 'Cooldown', 'Cooldown'],
  ['검성', 'Gladiator', 'Gladiator'], ['수호성', 'Templar', 'Templar'], ['궁성', 'Ranger', 'Ranger'], ['살성', 'Assassin', 'Assassin'], ['정령성', 'Spiritmaster', 'Spiritmaster'], ['마도성', 'Sorcerer', 'Sorcerer'],
  ['치유성', 'Cleric', 'Cleric'], ['호법성', 'Chanter', 'Chanter'], ['권성', 'Brawler (권성)', 'Brawler (권성)'], ['권갑', 'Fist', 'Fist'], ['브로치', 'Brooch', 'Brooch'], ['인장', 'Seal', 'Seal'], ['벨트', 'Belt', 'Belt'], ['아뮬렛', 'Amulet', 'Amulet'],
  ['쉬움', 'Facile', 'Easy'], ['보통', 'Normale', 'Normal'], ['어려움', 'Difficile', 'Hard'], ['예', 'Sì', 'Yes'], ['아니오', 'No', 'No'], ['매일', 'Ogni giorno', 'Daily'], ['매주', 'Ogni settimana', 'Weekly'], ['없음', 'Nessuno', 'None'],
].map(([k, it, en]) => [k, [it, en]])));

// table titles and group values
Object.assign(KO, Object.fromEntries([
  ["외형 합성 확률(천족)", "Sintesi aspetto (Elyos)", "Appearance synthesis (Elyos)"],
  ["외형 합성 확률(마족)", "Sintesi aspetto (Asmodian)", "Appearance synthesis (Asmodian)"],
  ["마석/영석 확률", "Manastone / Spirit stone", "Manastone / Spirit stone"],
  ["돌파 강화 확률", "Breakthrough", "Breakthrough"],
  ["레벨별 획득 가능 옵션 등급 확률", "Grado delle opzioni per livello", "Option grade by level"],
  ["영혼 각인 수치 부여 확률(장신구)", "Valori di Soul Engraving (accessori)", "Soul Engraving values (accessories)"],
  ["영혼 각인 수치 부여 확률(무기)", "Valori di Soul Engraving (armi)", "Soul Engraving values (weapons)"],
  ["영혼 각인 옵션 부여 확률(기타)", "Opzioni di Soul Engraving (altro)", "Soul Engraving options (other)"],
  ["장비 강화 확률", "Potenziamento", "Enhancement"],
  ["상자형 아이템 확률", "Forzieri e box", "Boxes"],
  ["영혼 각인 수치 부여 확률(방어구)", "Valori di Soul Engraving (armature)", "Soul Engraving values (armor)"],
  ["영혼 각인 옵션 부여 확률(무기)", "Opzioni di Soul Engraving (armi)", "Soul Engraving options (weapons)"],
  ["히든 큐브(천족) 확률", "Hidden Cube (Elyos)", "Hidden Cube (Elyos)"],
  ["영혼 각인 수치 부여 확률(기타)", "Valori di Soul Engraving (altro)", "Soul Engraving values (other)"],
  ["물질변환 확률", "Substance Morph", "Substance Morph"],
  ["히든 큐브(마족) 확률", "Hidden Cube (Asmodian)", "Hidden Cube (Asmodian)"],
  ["제작 확률", "Crafting", "Crafting"],
  ["몬스터 큐브 보상 확률", "Ricompense del Monster Cube", "Monster Cube rewards"],
  ["영혼 각인 옵션 부여 확률(방어구)", "Opzioni di Soul Engraving (armature)", "Soul Engraving options (armor)"],
  ["아이템 추출 확률", "Estrazione oggetti", "Item extraction"],
  ["아르카나 옵션 부여 확률", "Opzioni delle Arcana", "Arcana options"],
  ["오드 에너지 큐브 보상 확률", "Ricompense dell'Odd Energy Cube", "Odd Energy Cube rewards"],
  ["영혼 각인 옵션 부여 확률(장신구)", "Opzioni di Soul Engraving (accessori)", "Soul Engraving options (accessories)"],
  ["기본 보상", "Ricompensa garantita", "Guaranteed reward"],
  ["주요 보상", "Ricompensa principale", "Main reward"],
  ["선택 보상", "Ricompensa a scelta", "Chosen reward"],
  ["정복", "Conquista", "Conquest"],
  ["탐험", "Esplorazione", "Exploration"],
  ["초월", "Trascendenza", "Transcendence"],
  ["성역", "Santuario", "Sanctuary"],
  ["콤보", "Combo", "Combo"]
].map(([k, it, en]) => [k, [it, en]])));
// NCSOFT's notes under each table
const NOTES = Object.fromEntries([
  ["부여할 스탯의 종류가 결정되면 확률에 따라 수치가 결정됩니다.", "Scelto il tipo di statistica, il valore viene estratto con queste probabilità.", "Once the stat is chosen, its value is rolled with these chances."],
  ["각 스탯별 부여될 수 있는 수치에 대한 확률의 합은 100%입니다.", "Per ogni statistica, le probabilità dei valori sommano a 100%.", "For each stat, the value chances add up to 100%."],
  ["부여된 효과 수치는 아래의 방법을 통해 변경할 수 있습니다.", "I valori ottenuti si possono cambiare così:", "The rolled values can be changed this way:"],
  ["[영혼 각인] : 재화를 소모하여 부여된 스탯들의 수치를 현재보다 높은 수치로 변경합니다.", "[Soul Engraving]: spendendo valuta, porta i valori a uno più alto di quello attuale.", "[Soul Engraving]: spend currency to raise the values above the current ones."],
  ["이로 인해 보유한 장비의 효과에 따라서 같거나 낮은 효과 수치에 대한 확률은 제외되고, 상위 효과의 확률로 게임 내 공식에 따라 분배됩니다.", "Per questo le probabilità dei valori uguali o più bassi vengono escluse e ridistribuite su quelli più alti.", "So chances of equal or lower values are removed and redistributed to higher ones."],
  ["인 게임 확률 정보 안내를 통해 현재 보유한 스탯 수치에 따른 영혼 각인 시 수치 부여 확률을 안내받으실 수 있습니다.", "In gioco puoi vedere le probabilità aggiornate in base ai valori che hai.", "In game you can see the chances updated for your current values."],
  ["최초 영혼 각인 시 목록의 효과 중 '옵션 부여 수량'만큼 효과가 적용됩니다.", "Al primo Soul Engraving si ottengono tanti effetti quanto indicato in \"Opzioni assegnate\".", "On the first Soul Engraving you get as many effects as \"Options given\"."],
  ["'확정 부여'로 표기된 옵션이 존재하는 경우 해당 옵션들이 우선 확정적으로 부여됩니다.", "Le opzioni segnate \"Garantito\" vengono assegnate per prime, sempre.", "Options marked \"Guaranteed\" are always given first."],
  ["동일한 효과는 중복으로 적용되지 않습니다.", "Lo stesso effetto non può uscire due volte.", "The same effect cannot appear twice."],
  ["장비에 부여될 수 있는 최대 스킬 효과의 수는 '최대 스킬 옵션 수량'으로 제한됩니다.", "Gli effetti skill per pezzo sono al massimo \"Max opzioni skill\".", "Skill effects per item are capped by \"Max skill options\"."],
  ["스킬 효과가 부여될 때, 자신의 직업에 맞는 스킬 효과만 부여됩니다.", "Escono solo effetti skill della tua classe.", "Only skill effects of your class can appear."],
  ["옵션 종류에 따라 부여되는 수치는 별도로 고지된 [영혼 각인 수치 부여 확률] 정보에 따라 부여됩니다.", "Il valore di ogni opzione segue la tabella \"Valori di Soul Engraving\".", "Each option's value follows the \"Soul Engraving values\" table."],
  ["스킬 효과의 경우 '수치 값' 영역이 'Lv+1'과 같은 양식으로 기술됩니다.", "Per gli effetti skill il valore è scritto come \"Lv+1\".", "For skill effects the value reads like \"Lv+1\"."],
  ["[영혼 각인: 초기화]의 옵션 부여 확률은 이 페이지의 영혼 각인 옵션 부여 확률과 동일합니다.", "Il reset del Soul Engraving usa le stesse probabilità di questa pagina.", "A Soul Engraving reset uses the same chances as this page."],
  ["초기화 시, 기존에 부여된 효과는 모두 사라지고 새로운 효과가 부여됩니다.", "Con il reset tutti gli effetti vengono rimossi e riestratti.", "A reset removes all effects and rolls new ones."],
  ["[영혼 조율] 시스템을 이용하여 부여된 효과 중 한 개를 다른 효과로 다시 부여할 수 있습니다.", "Con \"Soul Tuning\" puoi riestrarre uno degli effetti.", "With Soul Tuning you can reroll one effect."],
  ["조율 대상인 효과를 포함하여, 기존에 부여된 효과와 동일한 효과는 중복으로 부여되지 않습니다.", "Non può uscire un effetto che hai già (compreso quello che stai cambiando).", "It cannot give an effect you already have (including the one being changed)."],
  ["기존 부여된 옵션의 확률들이 제외되기 때문에, 부여될 수 있는 옵션의 확률들이 인게임 공식에 따라 다시 계산됩니다.", "Le opzioni già presenti vengono escluse e le altre probabilità ricalcolate.", "Options you already have are excluded and the rest recalculated."],
  ["따라서 웹 확률 페이지에서 고지된 확률과 인게임에서 부여되는 확률이 상이합니다.", "Per questo in gioco le probabilità reali sono diverse da questa tabella.", "So the real chances in game differ from this table."],
  ["인게임 확률 정보 안내를 통해 현재 보유한 장비 효과에 따른 옵션 부여 확률을 안내받으실 수 있습니다.", "In gioco puoi vedere le probabilità per il tuo equipaggiamento attuale.", "In game you can see the chances for your current gear."],
  ["확률 획득 수량만큼 그룹에 해당하는 보상을 지급 시도합니다.", "Per ogni gruppo si fanno tante estrazioni quante indicate in \"Estrazioni\".", "Each group is rolled as many times as \"Rolls\"."],
  ["<묶음확률1>과 같은 보상 유형은 해당 목록 중 한 개의 보상을 지급합니다.", "I \"Gruppi\" danno UNA ricompensa della loro lista.", "\"Bundles\" give ONE reward from their list."],
  ["<개별확률>과 같은 보상 유형은 각각의 확률이 계산됩니다.", "Con \"Probabilità singola\" ogni oggetto ha la sua estrazione.", "With \"Individual chance\" each item is rolled on its own."],
  ["자신의 직업에 맞는 스킬 효과의 확률과 일반 스탯 효과 부여 확률의 합은 100%입니다.", "Effetti skill della tua classe + statistiche normali fanno 100%.", "Your class's skill effects + normal stats add up to 100%."],
  ["자신의 직업에 맞는 스킬 효과의 확률과 일반 스탯 효과 부여 확률의 합은 100%입니다", "Effetti skill della tua classe + statistiche normali fanno 100%.", "Your class's skill effects + normal stats add up to 100%."],
  ["재료로 사용한 외형의 등급에 따라 획득할 수 있는 외형의 확률 목록이 결정됩니다.", "Il grado degli aspetti usati decide la lista di quelli ottenibili.", "The grade of the appearances used decides what you can get."],
  ["무기 외형 획득 시 본인의 직업에 맞는 무기 외형만을 획득합니다.", "Gli aspetti d'arma escono solo per armi della tua classe.", "Weapon appearances only for your class's weapons."],
  ["행운의 기운 사용 시 상위 외형 그룹의 외형 획득 확률이 증가합니다.", "L'Aura della fortuna aumenta la probabilità del gruppo superiore.", "Lucky Aura raises the chance of the higher group."],
  ["각 단계의 강화 실패 횟수만큼 '강화 실패 시 보정 확률'이 강화 확률에 추가됩니다.", "Ogni fallimento a un livello aggiunge il \"Bonus per ogni fallimento\" alla probabilità.", "Each failure at a level adds the \"Bonus per failure\" to the chance."],
  ["각 행의 값은 '강화 단계'에 도달하기 위한 강화 비용 및 확률을 의미합니다.", "Ogni riga è costo e probabilità per ARRIVARE a quel livello.", "Each row is the cost and chance to REACH that level."],
  ["각 행의 값은 '강화 단계'에 도달하기 위한 강화 비용 및 확률을 의미합니다 .", "Ogni riga è costo e probabilità per ARRIVARE a quel livello.", "Each row is the cost and chance to REACH that level."],
  ["장비 레벨은 각 장비의 기본 아이템 레벨을 의미합니다. 강화 단계에 따라 인게임에서 아이템 레벨을 추가로 부여받습니다.", "\"Livello equip.\" è l'Item Level base: il potenziamento lo aumenta.", "\"Item level\" is the base Item Level; enhancement adds to it."],
  ["그룹 확률은 100%를 초과할 수 있으며, 초과하는 경우 100% 단위로 보상이 한 번씩 지급된 뒤, 100% 미만 확률에 대한 확률 보상을 시도합니다.", "Oltre il 100% ogni 100% è una ricompensa sicura, il resto è un'estrazione in più (es. 250% = 2 sicure + 50%).", "Above 100%, each 100% is a sure reward and the rest one more roll (e.g. 250% = 2 sure + 50%)."],
  ["그룹 확률 및 개별 확률은 100%를 초과할 수 있으며, 초과하는 경우 100% 단위로 보상이 한 번씩 지급된 뒤, 100% 미만 확률에 대한 확률 보상을 시도합니다.", "Oltre il 100% ogni 100% è una ricompensa sicura, il resto è un'estrazione in più.", "Above 100%, each 100% is a sure reward and the rest one more roll."],
  ["패키지 확률은 100%를 초과할 수 있으며, 초과하는 경우 100% 단위로 보상이 한 번씩 지급된 뒤, 100% 미만 확률에 대한 확률 보상을 시도합니다.", "Oltre il 100% ogni 100% è un pacchetto sicuro, il resto è un'estrazione in più.", "Above 100%, each 100% is a sure package and the rest one more roll."],
  ["열쇠 사용 여부에 따라 <일반보상> 또는 <열쇠보상>에 해당하는 보상을 획득합니다.", "Senza chiave ottieni la \"Ricompensa normale\", con la chiave quella \"Con la chiave\".", "Without a key you get the normal reward, with a key the key reward."],
  ["종족 이해도 레벨에 따라 획득 가능 옵션의 등급이 결정됩니다.", "Il livello di affinità decide il grado delle opzioni ottenibili.", "The affinity level decides the grade of the options."],
  ["<확률 획득1> 과 같은 보상 유형은 해당 목록 중 한 개의 보상을 지급합니다.", "Le \"Estrazioni\" danno UNA ricompensa della loro lista.", "\"Rolls\" give ONE reward from their list."],
  ["<선택 보상>과 같은 보상 유형은 목록의 보상 중 한 개를 선택해 확정적으로 획득할 수 있습니다.", "\"A scelta\": ne scegli una tu, sicura.", "\"Chosen\": you pick one, guaranteed."],
  ["<기본 보상>과 같은 보상 유형은 목록의 보상 모두를 확정적으로 획득할 수 있습니다.", "\"Garantita\": ottieni tutte le ricompense della lista.", "\"Guaranteed\": you get every reward in the list."],
  ["[제작 시스템]", "[Come funziona il crafting]", "[How crafting works]"],
  ["- 제작은 성공 게이지와 실패 게이지가 각각 누적되는 방식으로 진행됩니다.", "- Durante il craft si riempiono una barra di successo e una di fallimento.", "- Crafting fills a success bar and a failure bar."],
  ["- 제작 진행 중 성공 게이지 또는 실패 게이지가 1회 증가하는 단위를 '턴'이라고 합니다.", "- Ogni avanzamento di una delle due barre è un \"turno\".", "- Each step of either bar is a \"turn\"."],
  ["- 각 턴의 결과는 독립적으로 계산됩니다.", "- Ogni turno è indipendente.", "- Each turn is independent."],
  ["- 성공 게이지가 먼저 목표치에 도달하면 제작에 성공하고, 실패 게이지가 먼저 목표치에 도달하면 제작에 실패합니다.", "- Vince la barra che arriva prima in fondo.", "- Whichever bar fills first wins."],
  ["- 단, 제작 중 피격 등으로 제작이 취소될 경우 해당 제작은 실패로 처리됩니다.", "- Se vieni colpito e il craft si interrompe, conta come fallito.", "- If you are hit and crafting stops, it counts as a failure."],
  ["- 목표 게이지와 게이지 증가량은 레시피마다 다르게 적용되며, 이에 따라 제작 성공 확률도 달라집니다.", "- Barre e avanzamenti cambiano per ricetta, e quindi la probabilità.", "- Bars and steps differ per recipe, so does the chance."],
  ["- 캐릭터 숙련도와 레시피 요구 숙련도의 레벨 차이에 따라 게이지 증가량이 보정되며, 보정 결과는 최종 제작 성공 확률에 영향을 줍니다.", "- La differenza tra la tua maestria e quella richiesta cambia la probabilità finale (colonne \"Diff. livello\").", "- The gap between your mastery and the recipe's changes the final chance (\"Level gap\" columns)."],
  ["- 현재 페이지에서 안내되는 확률은 레시피별 게이지 정보와 숙련도 보정 등 제작 성공 확률에 영향을 주는 요소를 반영하여 계산된 결과입니다.", "- Le probabilità qui tengono già conto di tutto questo.", "- The chances here already include all of this."],
  ["주요 보상에 설정된 각 보상은 전체 큐브에서 1번만 등장합니다.", "Ogni ricompensa principale compare una sola volta in tutto il cubo.", "Each main reward appears only once in the whole cube."],
  ["큐브 선택에 따라 획득 여부가 달라질 수 있습니다.", "Dipende da quale cubo scegli.", "It depends on which cube you pick."],
  ["슬롯에 부여되는 옵션의 등급이 먼저 결정된 후 옵션의 종류가 결정됩니다.", "Prima si estrae il grado dell'opzione dello slot, poi il tipo.", "First the slot's option grade is rolled, then the type."],
  ["값이 범위로 설정된 항목은 해당 범위 내에서 균등 확률로 결정됩니다.", "I valori a intervallo escono con la stessa probabilità in tutto l'intervallo.", "Range values are uniform across the range."],
  ["장비 아이템은 추출 시 강화 단계에 따라 다른 결과물을 보상으로 획득하게 됩니다.", "Estraendo un equipaggiamento il risultato dipende dal suo potenziamento.", "Extracting gear gives results based on its enhancement level."],
  ["각 강화 단계에 해당하는 보상을 지정된 확률에 따라 지급합니다.", "Per ogni livello di potenziamento valgono le probabilità indicate.", "Each enhancement level uses the listed chances."],
  ["각 묶음 확률 내부의 아이템 중 1종을 지정된 확률에 따라 획득합니다", "Da ogni gruppo esce un solo oggetto, con queste probabilità.", "Each bundle gives one item with these chances."],
  ["스킬이 부여된 아르카나 성장 시 부여된 스킬 중 1개의 효과 레벨이 상승하며, 각 스킬의 레벨은 최대 4레벨까지 달성할 수 있습니다", "Facendo crescere un'Arcana con skill, sale di livello una delle skill (max livello 4).", "Growing an Arcana with skills levels up one skill (max level 4)."],
  ["스탯이 부여된 아르카나 성장 시, 부여된 스탯 중 한 종류가 '강화 성공시 성장 레벨/수치'만큼 상승합니다.", "Facendo crescere un'Arcana con statistiche, una sale della \"Crescita per potenziamento\".", "Growing an Arcana with stats raises one by \"Growth per enhancement\"."],
  ["스탯과 스킬 모두 성장 시 레벨이 상승 가능한 효과 중에서 균등 확률로 결정됩니다.", "L'effetto che cresce è scelto a caso tra quelli che possono salire.", "The growing effect is picked evenly among those that can grow."],
  ["한 아르카나에는 동일한 옵션이 부여되지 않습니다.", "Una Arcana non può avere due volte la stessa opzione.", "An Arcana cannot have the same option twice."],
  ["옵션은 순차적으로 부여되며, 각 옵션 부여 시 이미 부여된 옵션의 확률을 제외하고 확률이 다시 계산됩니다.", "Le opzioni escono una alla volta, escludendo quelle già uscite.", "Options are rolled one at a time, excluding those already rolled."],
  ["현재 페이지에 명시된 정보는 각 옵션이 첫 번째에 뽑힐 확률 정보입니다.", "Qui c'è la probabilità di uscire come PRIMA opzione.", "These are the chances to be the FIRST option."],
  ["동일한 옵션이 부여되지 않는다는 조건에 의해, 현재 웹페이지에서 명시된 '첫 번째에 뽑힐 확률'과 실제 획득하는 결과의 통계가 다릅니다.", "Per questo le statistiche reali sono diverse da queste.", "So real statistics differ from these."],
  ["아르카나 연성 시 부여되는 확률은 이 페이지에서 고지된 확률과 동일한 기준으로 결정됩니다.", "La trasmutazione delle Arcana usa le stesse probabilità.", "Arcana transmutation uses the same chances."],
  ["연성 시, 선택한 스킬 효과가 나올 확률을 제외하고 확률이 다시 계산됩니다.", "Nella trasmutazione la skill scelta viene esclusa e il resto ricalcolato.", "In transmutation the chosen skill is excluded and the rest recalculated."],
  ["현재 페이지에 명시된 정보는 각 스킬 효과가 첫 번째에 뽑힐 확률 정보입니다.", "Qui c'è la probabilità di uscire come PRIMO effetto.", "These are the chances to be the FIRST effect."],
  ["동일한 스킬이 부여되지 않는다는 조건에 의해, 현재 웹페이지에서 명시된 '첫 번째에 뽑힐 확률'과 연성 결과로 획득하는 스킬의 통계가 다릅니다.", "Per questo le statistiche reali della trasmutazione sono diverse.", "So real transmutation statistics differ."],
  ["누적 계승 횟수에 따라 계승 성공 확률이 결정됩니다.", "La probabilità dipende da quante eredità hai già fatto.", "The chance depends on how many inheritances you did."],
  ["누적 계승 횟수는 시즌 운영에 따라 초기화됩니다.", "Il conteggio si azzera con le stagioni.", "The count resets with seasons."],
  ["기본 재료를 보유한 경우 '기본 강화 확률'의 강화를 시도할 수 있습니다.", "Con i materiali base tenti con la \"Probabilità base\".", "With the base materials you try at the \"Base chance\"."],
  ["기본 재료에 더해 '추가 재료'를 사용하는 경우, 추가 재료를 투입한 횟수만큼 '추가 강화 확률'이 기본 강화 확률에 더해집니다.", "Ogni materiale extra aggiunge il bonus alla probabilità base.", "Each extra material adds the bonus to the base chance."],
  ["최종 강화 확률은 '최대 강화 확률'을 넘을 수 없으며, '최대 강화 확률'을 초과한 확률은 '최대 강화 확률'로 내림 처리 됩니다.", "La probabilità finale non supera la \"Probabilità massima\".", "The final chance cannot go above the \"Max chance\"."],
  ["재료로 사용한 신석의 등급에 따라 획득할 수 있는 신석의 확률 목록이 결정됩니다.", "Il grado delle Godstone usate decide la lista di quelle ottenibili.", "The grade of the Godstones used decides what you can get."],
  ["각 날개의 현재 강화 단계와 일치하는 보유 효과가 캐릭터에게 적용됩니다", "Ottieni l'effetto del livello attuale delle tue ali.", "You get the effect of your wings' current level."],
  ["일부 아이템의 강화 실패 시, 강화 실패 시 패널티가 ‘파괴’인 경우 장비가 파괴됩니다.", "Se \"Se fallisce\" dice \"Si distrugge\", l'oggetto si rompe al fallimento.", "If \"On failure\" says \"Destroyed\", the item breaks on failure."],
  ["강화 실패 시 패널티가 ‘유지’인 경우 각 단계의 강화 실패 횟수만큼 '강화 실패 시 보정 확률'이 강화 확률에 추가됩니다.", "Se dice \"Resta\", ogni fallimento aggiunge il bonus alla probabilità.", "If it says \"Kept\", each failure adds the bonus to the chance."]
].map(([k, it, en]) => [k, [it, en]]));
const PATTERNS = [
  [/^레벨 차이 (\d+)$/, (m, n) => (EN_UI ? `Level gap ${n}` : `Diff. livello ${n}`)], [/^외형명 - (.+)$/, (m, w) => `${EN_UI ? 'Appearance' : 'Aspetto'} - ${t(w)}`],
  [/^재료 (\d+)$/, (m, n) => `${EN_UI ? 'Material' : 'Materiale'} ${n}`], [/^재료 (\d+) 강화단계$/, (m, n) => `${EN_UI ? 'Enh.' : 'Pot.'} ${n}`], [/^재료 (\d+) 수량$/, (m, n) => `${EN_UI ? 'Qty' : 'Qtà'} ${n}`],
  [/^기본 재료 수량 (\d+)$/, (m, n) => `${EN_UI ? 'Base qty' : 'Qtà base'} ${n}`], [/^추가 재료 수량 (\d+)$/, (m, n) => `${EN_UI ? 'Extra qty' : 'Qtà extra'} ${n}`],
  [/^보유 효과 종류 (\d+)$/, (m, n) => `${EN_UI ? 'Effect' : 'Effetto'} ${n}`], [/^보유 효과 수치 (\d+)$/, (m, n) => `${EN_UI ? 'Value' : 'Valore'} ${n}`],
  [/^묶음확률\s*(\d+)$/, (m, n) => (EN_UI ? `Bundle ${n}` : `Gruppo ${n}`)],
  [/^확률 획득\s*(\d+)$/, (m, n) => (EN_UI ? `Roll ${n}` : `Estrazione ${n}`)], [/^(\d+)번 슬롯$/, (m, n) => `Slot ${n}`],
  [/^(.+)\[(쉬움|보통|어려움)\]$/, (m, a, b) => `${t(a)} [${t(b)}]`],
];
let NAMES_KO = {}, INDEX = null, CUR = null, SEL = null;
const t = (k) => {
  if (k == null || k === '') return '';
  const v = KO[k]; if (v) return v[EN_UI ? 1 : 0];
  if (NAMES_KO[k]) return NAMES_KO[k];
  for (const [re, fn] of PATTERNS) { const m = String(k).match(re); if (m) return fn(...m); }
  return k;
};
const isKo = (s) => /[가-힣]/.test(s);

function treeNode(n, depth) {
  if (n.id) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t(n.name); b.dataset.id = n.id; b.title = n.name;
    b.addEventListener('click', () => { open(n.id); if (matchMedia('(max-width: 860px)').matches) $('tree').classList.remove('open'); });
    return b;
  }
  const d = document.createElement('details'); d.open = depth === 0 && n.children.length <= 6;
  const s = document.createElement('summary'); s.textContent = t(n.name); s.title = n.name;
  const k = document.createElement('div'); k.className = 'kids'; k.append(...n.children.map((c) => treeNode(c, depth + 1)));
  d.append(s, k); return d;
}
function drawTree() {
  const tree = $('tree');
  const menu = document.createElement('button'); menu.type = 'button'; menu.className = 'menu'; menu.textContent = '☰ Categorie';
  menu.addEventListener('click', () => tree.classList.toggle('open'));
  const body = document.createElement('div'); body.className = 'tree-body';
  body.append(...INDEX.tree.map((n) => treeNode(n, 0)));
  tree.replaceChildren(menu, body);
}
const firstLeaf = (n) => (n.id ? n.id : n.children?.map(firstLeaf).find(Boolean));

function open(id, push = true) {
  SEL = id;
  document.querySelectorAll('#tree button[data-id]').forEach((b) => { const on = b.dataset.id === id; b.setAttribute('aria-current', String(on)); if (on) b.closest('details')?.setAttribute('open', ''); });
  if (push) history.replaceState(null, '', '?c=' + id);
  const cur = document.querySelector(`#tree button[data-id="${id}"]`), menu = document.querySelector('#tree .menu');
  if (menu && cur) menu.replaceChildren('☰ ', Object.assign(document.createElement('span'), {textContent: cur.textContent}));
  if (push && MOB.matches) { $('tree').classList.remove('open'); $('title').scrollIntoView({block: 'start', behavior: 'smooth'}); }
  $('tables').replaceChildren(Object.assign(document.createElement('p'), {className: 'empty', textContent: 'Caricamento…'}));
  getJSON(`data/odds/${id}.json`).then((d) => { if (SEL !== id) return; CUR = d; draw(); })
    .catch(() => $('tables').replaceChildren(Object.assign(document.createElement('p'), {className: 'empty', textContent: 'Non riesco a caricare questa tabella.'})));
}
function draw() {
  const d = CUR;
  $('title').textContent = t(d.path[d.path.length - 1]);
  $('path').textContent = d.path.map(t).join(' › ');
  document.title = `${t(d.path[d.path.length - 1])} · Probabilità (KR) · Aion 2 Market`;
  $('tables').replaceChildren(...d.tables.map(tableBox));
}
const PAGE = 200;
// phones: each table row becomes a small card (text on top, numbers as chips, the chance on the right); repeated cells are left out
const MOB = matchMedia('(max-width: 760px)');
const shortPct = (v) => (/^\d+\.\d{3,}%$/.test(v) ? +parseFloat(v).toFixed(parseFloat(v) >= 1 ? 2 : 4) + '%' : v);
function cards(table) {
  const heads = [...table.tHead.rows[0].cells].map((c) => c.textContent);
  const list = document.createElement('div'); list.className = 'cards';
  for (const tr of table.tBodies[0].rows) {
    const c = document.createElement('div'); c.className = 'rc' + (tr.className ? ' grp' : '');
    const top = document.createElement('div'); top.className = 'rt';
    const chips = document.createElement('div'); chips.className = 'rn';
    const cells = [...tr.cells], pi = cells.findIndex((td) => td.classList.contains('pm') && !td.classList.contains('rep'));
    cells.forEach((td, i) => {
      if (td.classList.contains('rep') || !td.textContent.trim() || (i === pi && pi >= 0)) return;
      if (td.classList.contains('n')) {
        const k = document.createElement('span'); k.className = 'chip' + (td.classList.contains('p') ? ' p' : '');
        const v = td.firstChild.textContent; k.title = v; k.append(Object.assign(document.createElement('small'), {textContent: heads[i]}), ' ' + shortPct(v)); chips.appendChild(k);
      } else {
        const v = document.createElement('span'); v.className = td.querySelector('.ko') ? 'it' : 'tx'; v.title = heads[i];
        v.append(...[...td.childNodes].map((n) => n.cloneNode(true))); top.appendChild(v);
      }
    });
    if (chips.children.length > 6) chips.classList.add('many');
    if (top.childNodes.length) c.appendChild(top);
    const row = document.createElement('div'); row.className = 'rb'; row.append(chips);
    if (pi >= 0 && /\d/.test(cells[pi].textContent)) row.appendChild(Object.assign(document.createElement('b'), {className: 'pc', textContent: shortPct(cells[pi].textContent), title: heads[pi] + ': ' + cells[pi].textContent}));
    c.appendChild(row); list.appendChild(c);
  }
  return list;
}
function tableBox(tb) {
  const box = document.createElement('section'); box.className = 'tbl';
  const h = document.createElement('h2'); h.textContent = t(tb.title); h.title = tb.title;
  const nd = document.createElement('details'); nd.className = 'nd'; nd.open = !MOB.matches;
  const notes = document.createElement('ul'); notes.className = 'notes';
  // NCSOFT's notes stay in Korean when we have no translation; the generic ones are summarised
  const GENERIC = /Ctrl\+F|반올림|페이지 전환/;
  const keep = tb.notes.filter((n) => !GENERIC.test(n));
  notes.append(Object.assign(document.createElement('li'), {textContent: EN_UI ? 'Chances are rounded, so totals may not be exactly 100%.' : 'Le probabilità sono arrotondate: i totali possono non fare esattamente 100%.'}),
    ...keep.map((n) => NOTES[n] ? Object.assign(document.createElement('li'), {textContent: NOTES[n][EN_UI ? 1 : 0], title: n}) : Object.assign(document.createElement('li'), {textContent: n, lang: 'ko'})));
  nd.append(Object.assign(document.createElement('summary'), {textContent: (EN_UI ? 'How it works' : 'Come funziona') + ` (${notes.children.length})`}), notes);
  const bar = document.createElement('div'); bar.className = 'bar';
  const q = document.createElement('input'); q.type = 'search'; q.placeholder = EN_UI ? 'Filter rows…' : 'Filtra le righe…';
  const count = document.createElement('span'); count.className = 'count'; bar.append(q, count);
  const sc = document.createElement('div'); sc.className = 'scroll';
  const pager = document.createElement('div'); pager.className = 'pager';
  const S = tb.s, F = tb.fields;
  const pct = F.map((f) => /확률/.test(f) && !/수량/.test(f)), main = F.reduce((m, f, i) => (pct[i] && !/보정|그룹|묶음|패키지|합|최대|추가|대성공|실패 시|행운/.test(f) ? i : m), -1), num = F.map((_, i) => tb.rows.slice(0, 50).every((r) => S[r[i]] === '' || !isNaN(+String(S[r[i]]).replace(/[%,]/g, ''))));
  const text = tb.rows.map((r) => r.map((v) => S[v] + ' ' + t(S[v])).join(' ').toLowerCase());
  let page = 0, rows = tb.rows.map((_, i) => i);
  const render = () => {
    const from = page * PAGE, part = rows.slice(from, from + PAGE);
    const table = document.createElement('table');
    const thead = table.createTHead().insertRow();
    F.forEach((f) => { const th = document.createElement('th'); th.textContent = t(f); th.title = f; thead.appendChild(th); });
    const body = table.createTBody(); let prev = null;
    part.forEach((ri) => {
      const r = tb.rows[ri], tr = body.insertRow();
      let lead = true;
      r.forEach((v, i) => {
        const td = tr.insertCell(), raw = S[v];
        const same = prev && lead && prev[i] === v && i < F.length - 1;
        if (!same) lead = false;
        if (i === 0 && !same && prev) tr.className = 'grp';
        let shown = t(raw); if (pct[i] && /\.\d*%$/.test(shown)) shown = shown.replace(/0+%$/, '%').replace(/\.%$/, '%');
        td.textContent = shown;
        if (shown !== raw && raw && isKo(raw) && NAMES_KO[raw]) { const k = document.createElement('span'); k.className = 'ko'; k.textContent = raw; td.appendChild(k); }
        if (num[i]) td.classList.add('n'); if (pct[i] && raw) td.classList.add('p'); if (same) td.classList.add('rep'); if (i === main) td.classList.add('pm');
      });
      prev = r;
    });
    sc.replaceChildren(MOB.matches ? cards(table) : table);
    const pages = Math.ceil(rows.length / PAGE) || 1;
    count.textContent = `${rows.length.toLocaleString(LOCALE)} ${EN_UI ? 'rows' : 'righe'}`;
    const btn = (label, to, dis) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = dis; b.addEventListener('click', () => { page = to; render(); box.scrollIntoView({block: 'start'}); }); return b; };
    pager.replaceChildren(...(pages > 1 ? [btn('‹', page - 1, page === 0), Object.assign(document.createElement('span'), {textContent: `${page + 1} / ${pages}`}), btn('›', page + 1, page >= pages - 1)] : []));
  };
  let timer;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { const w = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    rows = tb.rows.map((_, i) => i).filter((i) => w.every((x) => text[i].includes(x))); page = 0; render(); }, 200); });
  render(); MOB.addEventListener('change', render);
  box.append(h, nd, bar, sc, pager); return box;
}

Promise.all([getJSON('data/odds/index.json'), getJSON('data/odds/ko_en.json').catch(() => ({}))]).then(([idx, names]) => {
  INDEX = idx; NAMES_KO = names;
  const d = new Date(idx.updated);
  $('ver').textContent = (EN_UI ? 'Version of ' : 'Versione del ') + d.toLocaleDateString(LOCALE, {day: 'numeric', month: 'long', year: 'numeric'}) + '.';
  drawTree();
  const want = new URLSearchParams(location.search).get('c');
  open(want && /^[a-f0-9]{24}$/.test(want) ? want : INDEX.tree.map(firstLeaf).find(Boolean), false);
}).catch(() => $('tables').replaceChildren(Object.assign(document.createElement('p'), {className: 'empty', textContent: 'Le tabelle non sono ancora disponibili. Riprova tra poco.'})));
