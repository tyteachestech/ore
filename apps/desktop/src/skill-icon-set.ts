// The skill icons (D157): a curated set of MingCute fill glyphs, each redrawn on the UI icons' 16-pixel grid
// (scripts/pixel-skill-icons.ts, hand fixes in skill-icon-fixes.ts) and checked at 4× before it joined. Subjects a
// skill is about, in the order the picker shows them unfiltered; the words after a name are what finds it.
// Add a subject here, run the script, look at it zoomed, and fix it by hand if it reads badly.
export const SKILL_ICON_SET: readonly (readonly [name: string, words?: string])[] = [
  // Learning and thinking
  ["brain", "mind think learning memory"], ["bulb", "idea light"], ["book_2", "read"], ["book", "read"], ["notebook_2", "notes journal"], ["diary", "journal"],
  ["bookmark", ""], ["black_board", "teaching class lesson chalk"], ["mortarboard", "graduation degree school"],
  ["flask", "chemistry science lab"], ["test_tube", "chemistry lab"], ["science", "atom physics"], ["magnet", "physics"], ["balance", "law justice ethics"],
  ["eyeglass", "glasses reading"], ["speech", "talk presentation public speaking"], ["thought", "philosophy"], ["yinyang", "philosophy balance tao"],
  ["crystal_ball", "future prediction"], ["chess", "strategy game"],
  // Writing and language
  ["pen_2", "write"], ["pencil", "write draw"], ["quill_pen", "write story"], ["text", "typography"], ["font", "typography"],
  ["quote_left", "quote"], ["translate", "language"], ["hashtag", "social"], ["formula", "math"], ["omega", "math greek"], ["percentage", "math statistics"],
  ["list_check", "todo tasks"], ["table", "spreadsheet data"],
  // Code and systems
  ["code", "programming software"], ["terminal", "shell command line"], ["braces", "programming json"], ["bug", "debug"], ["git_branch", "git version control"],
  ["robot", "automation bot"], ["ai", "artificial intelligence sparkle"], ["chip", "hardware cpu"], ["server", "backend infrastructure"], ["web", "internet website"],
  ["computer", "desktop"], ["laptop", ""], ["keyboard", "typing"], ["cellphone", "phone mobile app"], ["display", "screen"], ["storage", "database disk"],
  ["sitemap", "structure hierarchy"], ["command", "shortcut"], ["game_1", "gaming controller"],
  // Art and design
  ["palette", "art colour paint"], ["paint_brush", "art paint"], ["brush_2", "art paint"], ["pen", "design vector"], ["scissors", "craft cut"], ["ruler", "measure"],
  ["layout", "design ui"], ["drawing_board", "sketch"], ["color_picker", "colour"],
  ["camera", "photography photo"], ["video", "film youtube"], ["film", "movie cinema"], ["clapperboard", "movie film making"], ["movie", "cinema"],
  // Music and sound
  ["music", "song"], ["headphone", "listen podcast audio"], ["mic", "microphone podcast singing"], ["guitar", "instrument"], ["drum", "instrument percussion"],
  ["disc", "record vinyl dj"], ["radio", ""], ["speaker", "sound"],
  // Body and health
  ["heart", "love health"], ["lungs", "breathing"], ["eye_2", "see vision"], ["ear", "hearing"], ["hand", ""],
  ["skull", "anatomy"], ["capsule", "medicine pill"], ["first_aid_kit", "medical"], ["dental", "teeth"],
  ["pray", "meditation faith"], ["zazen", "meditation"], ["yoga", ""], ["moon", "sleep night"],
  // Sport and movement
  ["run", "running"], ["walk", "walking"], ["fitness", "gym"], ["barbell", "weights lifting gym"],
  ["basketball", ""], ["football", "soccer"], ["american_football", ""], ["baseball", ""], ["badminton", ""], ["pingpong", "table tennis"],
  ["skateboard", ""], ["surfboard", "surf"], ["sword", "fencing martial arts"],
  // Nature and animals
  ["leaf", "plant habit growth"], ["tree", "forest"], ["flower", "garden"], ["sunflower", "garden"], ["cactus", "plant"], ["mushroom", "fungi"],
  ["mountain", "outdoors"], ["campfire", "camping"], ["tent", "camping"], ["sun_2", "sun weather day"], ["cloud", "weather"], ["lightning", "energy storm"],
  ["snowflake", "winter"], ["rainbow", ""], ["wave", "ocean sea"], ["wind", "weather"], ["thermometer", "temperature"], ["umbrella", "rain"],
  ["cat", "pet animal"], ["dog", "pet animal"], ["bird", "animal"], ["butterfly", "animal"], ["bear", "animal"], ["paw", "pet animal"], ["fish", "fishing animal"],
  ["globe", "world geography"], ["earth", "world geography"], ["planet", "space astronomy"], ["rocket", "space launch startup"], ["telescope", "astronomy"], ["microscope", "biology"],
  // Food
  ["fork_knife", "cooking food restaurant"], ["chef_hat", "cooking chef"], ["cake", "baking"], ["bread", "baking"], ["pizza", "food"], ["hamburger", "food"],
  ["teacup", "tea"], ["wine", "wine tasting"], ["egg", ""], ["soup_pot", "cooking"], ["chopsticks", "asian food"],
  // Money and work
  ["briefcase", "work business job"], ["coin", "money finance"], ["currency_dollar", "money finance"], ["wallet", "money budget"], ["pig_money", "savings"],
  ["chart_bar", "statistics data analytics"], ["chart_line", "growth trend"], ["chart_pie", "statistics"], ["stock", "investing markets"],
  ["target", "goal focus aim"], ["trophy", "win achievement"], ["medal", "award"], ["award", "badge"], ["calendar", "planning schedule time"],
  ["clock", "time"], ["presentation_1", "slides pitch"], ["shopping_cart_1", "shopping ecommerce"], ["gift", "present"], ["tag", "price label"],
  ["ticket", "events"], ["flag_1", "milestone"], ["auction", "law gavel"], ["seal", "stamp official"], ["user_1", "person self"], ["group", "people team"],
  ["contacts", "network relationships"], ["IDcard", "identity"], ["chat_1", "chat conversation talk"], ["mail", "email letter"], ["send_plane", "message"],
  ["phone", "call"],
  // Places and travel
  ["house", "home"], ["school", ""], ["bank", "finance"], ["hospital", "medicine"], ["church", "faith"], ["factory", "industry"], ["store", "shop retail"],
  ["building_1", "city architecture"], ["bridge", "engineering"], ["car", "driving"], ["airplane", "travel flight"],
  ["ship", "sailing"], ["sailboat", "sailing"], ["train", "travel"], ["bus", ""], ["truck", ""], ["UFO", "aliens"], ["map", "geography travel"],
  ["location", "place"], ["compass", "navigation direction"], ["anchor", "sailing"],
  // Tools and craft
  ["hammer", "building woodworking"], ["axe", "woodworking"], ["screwdriver", "repair"], ["pickax", "mining"], ["balloon_2", "party"],
  ["sparkles", "magic new"], ["star_2", "star favourite"], ["key_2", "key security"], ["lock", "security privacy"], ["shield", "security defence"],
  ["t_shirt_2", "fashion clothes"], ["dress", "fashion"], ["shoe", "fashion"], ["lipstick", "makeup beauty"], ["parfum", "perfume"],
];
