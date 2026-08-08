// Flat pool of everyday, family-friendly English words the generator draws
// from -- no themes/categories for v1 (see the approved plan). Deliberately
// includes some words outside the 3-9 letter window generation actually uses
// (see `sanitizeWordBank` in ../generator.ts, which filters/dedupes this at
// import time) -- easier to hand-curate a broad, natural list than to police
// every entry's exact length by eye.
export const EN_WORDS: string[] = [
  // animals
  'cat', 'dog', 'cow', 'pig', 'hen', 'fox', 'owl', 'bee', 'ant', 'bat', 'rat',
  'bear', 'wolf', 'lion', 'deer', 'frog', 'duck', 'goat', 'lamb', 'seal', 'crab',
  'moth', 'worm', 'hawk', 'swan', 'mule', 'mole', 'bird', 'fish', 'horse', 'sheep',
  'mouse', 'tiger', 'zebra', 'camel', 'otter', 'rabbit', 'monkey', 'turtle', 'dolphin',
  'giraffe', 'penguin', 'panther', 'leopard', 'elephant', 'kangaroo', 'squirrel',
  'hedgehog', 'chicken', 'rooster', 'donkey', 'puppy', 'kitten', 'whale', 'shark',
  'snake', 'lizard', 'spider', 'beetle', 'cricket', 'panda', 'koala', 'gorilla',
  'buffalo', 'walrus', 'falcon', 'eagle', 'raven', 'sparrow', 'pigeon', 'parrot',
  'peacock', 'ostrich', 'flamingo', 'jellyfish', 'octopus', 'lobster', 'oyster',
  'salmon', 'trout', 'badger', 'beaver', 'ferret', 'weasel', 'raccoon', 'possum',
  'coyote', 'jaguar', 'cheetah', 'cobra', 'python', 'gecko', 'iguana',

  // food & drink
  'apple', 'grape', 'lemon', 'mango', 'melon', 'peach', 'plum', 'cherry', 'banana',
  'orange', 'pear', 'berry', 'olive', 'garlic', 'onion', 'carrot', 'potato', 'tomato',
  'pepper', 'cabbage', 'lettuce', 'spinach', 'pumpkin', 'cucumber', 'broccoli',
  'mushroom', 'avocado', 'coconut', 'pineapple', 'walnut', 'almond', 'peanut',
  'cashew', 'cheese', 'butter', 'yogurt', 'cream', 'sugar', 'flour', 'bread',
  'toast', 'bacon', 'sausage', 'burger', 'pizza', 'pasta', 'noodle', 'cereal',
  'pancake', 'waffle', 'cookie', 'biscuit', 'muffin', 'donut', 'cupcake',
  'chocolate', 'vanilla', 'honey', 'syrup', 'jam', 'salad', 'soup', 'stew',
  'curry', 'rice', 'beans', 'lentil', 'coffee', 'tea', 'juice', 'water', 'milk',
  'wine', 'cider', 'sandwich', 'omelet', 'popcorn', 'pretzel', 'pickle', 'ketchup',
  'mustard', 'vinegar', 'cinnamon', 'nutmeg', 'basil', 'thyme', 'parsley', 'oregano',

  // household
  'table', 'chair', 'sofa', 'couch', 'lamp', 'mirror', 'blanket', 'pillow',
  'curtain', 'carpet', 'cabinet', 'drawer', 'shelf', 'closet', 'kitchen', 'bedroom',
  'bathroom', 'window', 'ceiling', 'hallway', 'fireplace', 'mailbox', 'umbrella',
  'basket', 'bucket', 'broom', 'sponge', 'towel', 'napkin', 'plate', 'bowl',
  'spoon', 'fork', 'knife', 'kettle', 'toaster', 'blender', 'fridge', 'oven',
  'stove', 'microwave', 'vacuum', 'candle', 'lantern', 'battery', 'remote',
  'keyboard', 'monitor', 'printer', 'speaker', 'camera', 'calendar', 'notebook',
  'envelope', 'stapler', 'scissors', 'ruler', 'eraser', 'crayon', 'marker', 'sticker',

  // nature & weather
  'mountain', 'valley', 'river', 'ocean', 'forest', 'desert', 'island', 'volcano',
  'glacier', 'meadow', 'jungle', 'canyon', 'prairie', 'swamp', 'cave', 'cliff',
  'beach', 'shore', 'cloud', 'rainbow', 'thunder', 'lightning', 'blizzard',
  'tornado', 'drizzle', 'sunshine', 'sunset', 'sunrise', 'breeze', 'storm',
  'frost', 'icicle', 'avalanche', 'tide', 'wave', 'current', 'pebble', 'boulder',
  'gravel', 'soil', 'mud', 'dust', 'ash', 'smoke', 'flame', 'spark', 'ember',

  // body
  'head', 'neck', 'shoulder', 'elbow', 'wrist', 'finger', 'thumb', 'knee',
  'ankle', 'heel', 'chest', 'stomach', 'spine', 'muscle', 'eyebrow', 'eyelash',
  'forehead', 'cheek', 'chin', 'tongue', 'throat', 'lung', 'heart', 'brain',
  'kidney', 'liver', 'skin', 'nail', 'hair',

  // family & people
  'mother', 'father', 'sister', 'brother', 'cousin', 'nephew', 'niece',
  'grandma', 'grandpa', 'husband', 'friend', 'neighbor', 'teacher', 'student',
  'doctor', 'nurse', 'farmer', 'painter', 'singer', 'dancer', 'writer', 'driver',
  'pilot', 'sailor', 'soldier', 'police', 'plumber', 'builder', 'baker', 'butcher',
  'tailor', 'barber', 'waiter',

  // clothing
  'shirt', 'jacket', 'sweater', 'sock', 'glove', 'scarf', 'boot', 'shoe',
  'sandal', 'dress', 'skirt', 'pants', 'jeans', 'shorts', 'coat', 'blazer',
  'vest', 'pajama', 'belt', 'button', 'zipper', 'pocket', 'collar', 'sleeve',
  'hood', 'mitten', 'apron',

  // colors & shapes
  'red', 'blue', 'green', 'yellow', 'purple', 'pink', 'brown', 'black', 'white',
  'gray', 'silver', 'golden', 'circle', 'square', 'triangle', 'diamond', 'oval',
  'cube', 'sphere', 'cylinder', 'pyramid', 'spiral',

  // sports & games
  'soccer', 'tennis', 'hockey', 'rugby', 'golf', 'boxing', 'wrestling',
  'swimming', 'running', 'cycling', 'skating', 'skiing', 'surfing', 'diving',
  'climbing', 'archery', 'fencing', 'bowling', 'chess', 'checkers', 'puzzle',
  'domino', 'marble', 'balloon', 'kite', 'yoyo', 'whistle', 'trophy', 'medal',
  'referee', 'stadium', 'racket', 'helmet',

  // verbs
  'jump', 'run', 'walk', 'swim', 'dance', 'sing', 'laugh', 'smile', 'whisper',
  'shout', 'listen', 'watch', 'dream', 'sleep', 'wake', 'climb', 'crawl',
  'slide', 'throw', 'catch', 'kick', 'punch', 'hug', 'kiss', 'wave', 'clap',
  'cook', 'bake', 'chop', 'slice', 'pour', 'mix', 'stir', 'boil', 'freeze',
  'melt', 'grow', 'plant', 'water', 'harvest', 'build', 'paint', 'draw',
  'write', 'read', 'learn', 'teach', 'study', 'think', 'remember', 'forget',
  'imagine', 'create', 'invent', 'discover', 'explore', 'travel', 'journey',
  'arrive', 'depart', 'return',

  // technology
  'computer', 'laptop', 'tablet', 'phone', 'internet', 'website', 'software',
  'keyboard', 'monitor', 'printer', 'scanner', 'router', 'wireless', 'battery',
  'charger', 'headset', 'microphone', 'speaker', 'camera', 'video', 'photo',
  'image', 'message', 'email', 'password', 'download', 'upload', 'browser', 'network',

  // transportation
  'car', 'truck', 'bus', 'train', 'plane', 'airplane', 'bicycle', 'motorcycle',
  'scooter', 'boat', 'ship', 'canoe', 'kayak', 'submarine', 'rocket', 'subway',
  'tractor', 'wagon', 'sled', 'elevator', 'highway', 'bridge', 'tunnel',
  'airport', 'station', 'harbor', 'runway', 'garage', 'parking',

  // music & art
  'guitar', 'piano', 'violin', 'drum', 'trumpet', 'flute', 'clarinet',
  'saxophone', 'harp', 'cello', 'orchestra', 'melody', 'rhythm', 'chorus',
  'lyric', 'concert', 'painting', 'sculpture', 'canvas', 'palette', 'brush',
  'sketch', 'portrait', 'gallery', 'museum', 'theater', 'cinema', 'costume', 'mask',

  // school
  'pencil', 'eraser', 'notebook', 'backpack', 'textbook', 'homework',
  'classroom', 'lesson', 'lecture', 'exam', 'quiz', 'grade', 'diploma',
  'library', 'cafeteria', 'playground', 'recess', 'science', 'history',
  'biology', 'geography', 'grammar', 'language',

  // misc
  'castle', 'bridge', 'tower', 'palace', 'temple', 'church', 'cathedral',
  'village', 'planet', 'galaxy', 'universe', 'comet', 'meteor', 'satellite',
  'telescope', 'compass', 'globe', 'treasure', 'pirate', 'dragon', 'wizard',
  'knight', 'princess', 'kingdom', 'adventure', 'mystery', 'secret', 'riddle',
  'legend', 'myth', 'story', 'fable', 'poem', 'novel', 'chapter', 'letter',
  'journal', 'diary', 'memory', 'moment', 'future',
];
