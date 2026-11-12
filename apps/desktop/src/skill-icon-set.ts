// The skill icons (D157): a curated set of MingCute fill glyphs, each redrawn on the UI icons' 16-pixel grid
// (scripts/pixel-skill-icons.ts, hand fixes in skill-icon-fixes.ts) and checked at 4× before it joined. Subjects a
// skill is about, in the order the picker shows them unfiltered; the words after a name are what finds it: its synonyms and
// the subjects someone studying it would type ("finance" finds the coin, "teacher" the blackboard), so a search never needs the icon's own name.
// Add a subject here, run the script, look at it zoomed, and fix it by hand if it reads badly.
export const SKILL_ICON_SET: readonly (readonly [name: string, words?: string])[] = [
  // Learning and thinking
  ["brain", "mind think learning memory psychology neuroscience cognition intelligence study mental"], ["bulb", "idea light insight creativity innovation invention eureka"], ["book_2", "read reading literature study textbook novel library"], ["book", "read reading literature study textbook novel library"], ["notebook_2", "notes journal writing diary study log"], ["diary", "journal notes writing log reflection"],
  ["bookmark", "save reading favourite favorite later mark"], ["black_board", "teaching class lesson chalk school education teacher course lecture whiteboard"], ["mortarboard", "graduation degree school university college education academic study cap"],
  ["flask", "chemistry science lab experiment research beaker"], ["test_tube", "chemistry lab science experiment biology research"], ["science", "atom physics chemistry nuclear quantum molecule research"], ["magnet", "physics magnetism attraction electricity pull"], ["balance", "law justice ethics legal scales fairness court philosophy"],
  ["eyeglass", "glasses reading vision sight spectacles nerd study"], ["speech", "talk presentation public speaking podium lecture rhetoric debate communication"], ["thought", "philosophy thinking idea reflection bubble mind"], ["yinyang", "philosophy balance tao zen harmony eastern religion spirituality"],
  ["crystal_ball", "future prediction forecast fortune magic strategy"], ["chess", "strategy game knight tactics board thinking"],
  // Writing and language
  ["pen_2", "write writing author story essay blog copywriting"], ["pencil", "write draw writing sketch edit note school"], ["quill_pen", "write story writing author poetry fiction literature history feather"], ["text", "typography writing words letters type"], ["font", "typography letters type design alphabet writing"],
  ["quote_left", "quote quotation citation saying speech writing"], ["translate", "language languages foreign spanish french linguistics vocabulary words"], ["hashtag", "social media twitter tag trending marketing number"], ["formula", "math mathematics sum sigma algebra calculus equation statistics"], ["omega", "math greek mathematics physics symbol letter ohm"], ["percentage", "math statistics percent ratio discount probability finance"],
  ["list_check", "todo tasks checklist productivity planning habits done"], ["table", "spreadsheet data grid excel rows database"],
  // Code and systems
  ["code", "programming software coding developer engineering html web"], ["terminal", "shell command line cli console bash programming coding unix"], ["braces", "programming json code coding javascript brackets software"], ["bug", "debug insect beetle testing error entomology"], ["git_branch", "git version control branch merge github source"],
  ["robot", "automation bot robotics machine android ai"], ["ai", "artificial intelligence sparkle machine learning ml llm gpt magic"], ["chip", "hardware cpu processor electronics semiconductor computer circuit"], ["server", "backend infrastructure devops hosting cloud database systems network"], ["web", "internet website browser frontend page online"],
  ["computer", "desktop pc monitor tech it computing"], ["laptop", "computer notebook macbook tech work remote"], ["keyboard", "typing keys input shortcuts writing"], ["cellphone", "phone mobile app smartphone iphone android ios"], ["display", "screen monitor tv presentation"], ["storage", "database disk data drive backup sql"],
  ["sitemap", "structure hierarchy tree organization architecture system diagram"], ["command", "shortcut mac keyboard key apple"], ["game_1", "gaming controller video games play console esports"],
  // Art and design
  ["palette", "art colour color paint painting creativity design artist"], ["paint_brush", "art paint painting artist drawing creativity"], ["brush_2", "art paint painting artist decorating"], ["pen", "design vector illustration drawing graphic figma"], ["scissors", "craft cut sewing tailoring hair paper"], ["ruler", "measure measurement geometry drafting length maths"],
  ["layout", "design ui ux interface web grid wireframe"], ["drawing_board", "sketch drawing design art drafting easel"], ["color_picker", "colour color design eyedropper paint"],
  ["camera", "photography photo picture photographer image"], ["video", "film youtube filming creator recording vlog content"], ["film", "movie cinema video filmmaking editing reel"], ["clapperboard", "movie film making directing cinema production screenwriting"], ["movie", "cinema film reel theatre entertainment"],
  // Music and sound
  ["music", "song notes melody singing theory composing audio"], ["headphone", "listen podcast audio music listening sound"], ["mic", "microphone podcast singing voice speaking recording karaoke audio"], ["guitar", "instrument music playing band strings rock"], ["drum", "instrument percussion music rhythm band beat"],
  ["disc", "record vinyl dj music album cd"], ["speaker", "sound audio music volume stereo"],
  // Body and health
  ["heart", "love health relationships cardio wellbeing emotion care"], ["lungs", "breathing respiration breath health anatomy medicine"], ["eye_2", "see vision sight observation watching anatomy"], ["ear", "hearing listening sound audio anatomy"],
  ["skull", "anatomy bones death danger skeleton medicine"], ["capsule", "medicine pill drug pharmacy health supplements vitamins pharmacology"], ["first_aid_kit", "medical health emergency doctor nursing medicine safety"], ["dental", "teeth tooth dentist dentistry health"],
  ["pray", "meditation faith prayer religion spirituality gratitude mindfulness"], ["zazen", "meditation mindfulness zen calm buddhism breathing"], ["yoga", "stretching exercise mindfulness flexibility fitness wellness meditation"], ["moon", "sleep night rest astronomy dream lunar"],
  // Sport and movement
  ["run", "running jogging exercise fitness cardio marathon sport"], ["walk", "walking steps exercise hiking stroll"], ["barbell", "weights lifting gym fitness strength workout exercise training bodybuilding"],
  ["basketball", "sport ball hoops nba game"], ["football", "soccer sport ball game"], ["american_football", "sport nfl ball game rugby"], ["baseball", "sport ball mlb game softball"], ["badminton", "sport racket shuttlecock tennis game"], ["pingpong", "table tennis sport paddle game racket"],
  ["skateboard", "skating skate sport board"], ["surfboard", "surf surfing ocean waves sport beach"], ["sword", "fencing martial arts fighting combat history medieval"],
  // Nature and animals
  ["leaf", "plant habit growth nature ecology environment green botany health"], ["tree", "forest nature plant environment wood ecology outdoors"], ["flower", "garden gardening plant nature botany bloom"], ["sunflower", "garden gardening plant nature flower botany"], ["cactus", "plant desert succulent nature gardening"], ["mushroom", "fungi foraging mycology nature cooking"],
  ["mountain", "outdoors hiking climbing nature adventure trekking peak"], ["campfire", "camping fire outdoors survival bushcraft"], ["tent", "camping outdoors travel adventure"], ["sun_2", "sun weather day summer energy solar morning"], ["cloud", "weather sky computing meteorology"], ["lightning", "energy storm electricity power speed bolt fast"],
  ["snowflake", "winter snow cold ice skiing weather"], ["rainbow", "colour color weather pride hope"], ["wave", "ocean sea water surf swimming marine"], ["wind", "weather air breeze climate"], ["thermometer", "temperature weather fever heat climate"], ["umbrella", "rain weather insurance protection"],
  ["cat", "pet animal kitten feline"], ["dog", "pet animal puppy canine training"], ["bird", "animal birding birdwatching ornithology nature"], ["butterfly", "animal insect nature transformation change"], ["bear", "animal wildlife nature"], ["paw", "pet animal dog cat veterinary wildlife"], ["fish", "fishing animal aquarium marine seafood"],
  ["globe", "world geography global international travel countries"], ["earth", "world geography planet environment climate global"], ["planet", "space astronomy saturn science cosmos universe"], ["rocket", "space launch startup growth entrepreneurship fast"], ["telescope", "astronomy space stars science observation"], ["microscope", "biology science lab research medicine cells"],
  // Food
  ["fork_knife", "cooking food restaurant eating nutrition diet meal dining"], ["chef_hat", "cooking chef kitchen culinary food recipes"], ["cake", "baking dessert birthday pastry sweet"], ["bread", "baking sourdough food bakery"], ["pizza", "food cooking italian"], ["hamburger", "food burger fast cooking"],
  ["teacup", "tea coffee drink cafe break"], ["wine", "wine tasting drink cocktail alcohol glass"], ["egg", "food breakfast cooking protein"], ["soup_pot", "cooking soup stew kitchen food"], ["chopsticks", "asian food chinese japanese sushi cooking"],
  // Money and work
  ["briefcase", "work business job career professional office management"], ["coin", "money finance cash investing economics currency"], ["currency_dollar", "money finance dollar cash economics investing income"], ["wallet", "money budget spending personal finance cash"], ["pig_money", "savings saving money piggy bank finance budget"],
  ["chart_bar", "statistics data analytics graph metrics business"], ["chart_line", "growth trend graph analytics data progress stocks"], ["chart_pie", "statistics data analytics graph share"], ["stock", "investing markets trading finance candlestick shares"],
  ["target", "goal focus aim attention objective productivity archery"], ["trophy", "win achievement success competition champion award"], ["medal", "award achievement winner sport honour"], ["award", "badge achievement prize certificate recognition"], ["calendar", "planning schedule time date events productivity"],
  ["clock", "time management productivity schedule hours"], ["presentation_1", "slides pitch presenting keynote talk powerpoint"], ["shopping_cart_1", "shopping ecommerce retail store buy sales"], ["gift", "present birthday giving generosity"], ["tag", "price label sale category marketing"],
  ["ticket", "events concert cinema travel pass"], ["flag_1", "milestone goal country finish marker"], ["auction", "law gavel judge court legal bidding"], ["seal", "stamp official approval certificate legal"], ["user_1", "person self identity personal profile me"], ["group", "people team community social leadership management family"],
  ["IDcard", "identity id profile badge licence passport"], ["chat_1", "chat conversation talk communication messaging discussion social language"], ["mail", "email letter inbox writing communication newsletter"], ["send_plane", "message send paper plane email communication"],
  ["phone", "call telephone sales contact communication"],
  // Places and travel
  ["house", "home family property real estate household"], ["school", "education class learning teaching campus students"], ["bank", "finance money banking government institution economics"], ["hospital", "medicine health medical doctor nursing care"], ["church", "faith religion christianity spirituality worship"], ["factory", "industry manufacturing production engineering operations"], ["store", "shop retail business commerce market"],
  ["building_1", "city architecture office urban real estate company"], ["bridge", "engineering civil construction architecture connection"], ["car", "driving auto vehicle mechanics transport"], ["airplane", "travel flight aviation flying pilot trip"],
  ["ship", "sailing boat cruise navy maritime shipping"], ["sailboat", "sailing boat yacht sea"], ["train", "travel rail railway transport commute"], ["bus", "transport travel commute public"], ["truck", "transport logistics delivery shipping moving"], ["UFO", "aliens space sci-fi science fiction mystery"], ["map", "geography travel navigation directions cartography"],
  ["location", "place pin map gps address"], ["compass", "navigation direction orienteering travel explore guidance"], ["anchor", "sailing boat sea navy stability"],
  // Tools and craft
  ["hammer", "building woodworking diy tools construction repair carpentry"], ["axe", "woodworking wood chopping tools forestry"], ["screwdriver", "repair tools diy fix maintenance"], ["pickax", "mining tools digging geology crypto"], ["balloon_2", "party birthday celebration fun"],
  ["sparkles", "magic new clean shine special"], ["star_2", "star favourite favorite rating best astronomy"], ["key_2", "key security password access unlock"], ["lock", "security privacy password safe encryption cybersecurity"], ["shield", "security defence defense protection safety cybersecurity insurance"],
  ["t_shirt_2", "fashion clothes clothing style apparel"], ["dress", "fashion clothes clothing style sewing"], ["shoe", "fashion sneakers footwear running style"], ["lipstick", "makeup beauty cosmetics style"], ["parfum", "perfume fragrance scent beauty"],
];

/** `words`: the name as words plus the words that find it ("book 2 read …"), lowercased. */
export type SkillIcon = { name: string; words: string };
const ICONS: SkillIcon[] = SKILL_ICON_SET.map(([name, words = ""]) => ({ name, words: `${name.replaceAll("_", " ")} ${words}`.toLowerCase() }));
/** The picker's search: the exact name, then names starting with the query, then a whole word, then a word starting with it, then names
    containing it (three letters or more). A word only matches from its start, so "ai" does not find the train or the paint brush. */
export const findSkillIcons = (query: string): SkillIcon[] => {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return ICONS;
  const name = (i: SkillIcon) => i.name.replaceAll("_", " ");
  const rank = (i: SkillIcon) => (name(i) === q ? 0 : name(i).startsWith(q) ? 1 : ` ${i.words} `.includes(` ${q} `) ? 2 : ` ${i.words}`.includes(` ${q}`) ? 3 : q.length > 2 && name(i).includes(q) ? 4 : 5);
  return ICONS.map((i) => ({ i, r: rank(i) }))
    .filter((x) => x.r < 5)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.i);
};
