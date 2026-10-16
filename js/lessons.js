// The curriculum. Kerning lessons are scored against the typeface's own
// kerning (Source Serif 4's OpenType kerning, drawn by its designers).
// Leading, measure and word spacing have no single right answer, so each
// is scored against a comfortable band rather than one magic number.

// Comfortable leading grows with the measure: longer lines need more air
// so the eye can find the start of the next one. Roughly in line with
// Butterick's 120 to 145% for body text, shifted by line length.
export function leadingBand(measure) {
  const low = +(1.2 + (measure - 20) * 0.006).toFixed(2);
  return [low, +(low + 0.16).toFixed(2)];
}

export const lessons = [
  {
    type: 'kern', word: 'WAVE', movable: [1, 2], start: { 1: 14, 2: -9 },
    title: 'Optical spacing',
    desc: 'Kerning is optical. Move individual letters until the white space between them feels even. Practise knocks a few letters out of place; your job is to restore the rhythm.',
    matters: 'Look at the white space between letters as shapes. The boxes the letters sit in are irrelevant; the visible outlines are what your eye reads.',
    why: 'Uneven kerning creates small visual jolts. Good kerning turns separate letters into one continuous rhythm.',
    tips: [
      'Select a letter and the others fade back, so you can judge just that relationship.',
      'Diagonal letters like W, A and V leave triangles of white space that need pulling in harder.',
      'Squint, or press Blur, to stop reading the word and see the spacing as texture.',
    ],
  },
  {
    type: 'kern', word: 'AVATAR', movable: [1, 2, 4], start: { 1: 15, 2: -10, 4: 12 },
    title: 'Diagonal pairs',
    desc: 'Diagonal pairs need more correction than any other kind, because their outlines leave large wedges of white space.',
    matters: 'Don’t space the boxes. Compare the wedges of white between A–V, V–A and A–T.',
    why: 'Spaced mechanically, diagonals look detached from each other. Pulling them in restores a steady rhythm.',
    tips: ['Work one pair at a time.', 'Compare similar relationships elsewhere in the same word.', 'Flip the word upside down when reading it gets in the way.'],
  },
  {
    type: 'kern', word: 'ToYo', movable: [1, 3], start: { 1: 13, 3: -9 },
    title: 'Curves & stems',
    desc: 'Curves pull away from their edges while straight stems make hard ones. Good spacing evens out that difference.',
    matters: 'Compare the pocket under the T with the softer space around the round o.',
    why: 'Different shapes leave different amounts of white. Good spacing makes those transitions feel equally weighted.',
    tips: ['Hard verticals and soft curves rarely want the same numeric gap.', 'Judge the transitions, not the letters.', 'If the word looks lumpy, one relationship is probably too dominant.'],
  },
  {
    type: 'kern', word: 'LYRIC', movable: [1, 2, 3], start: { 1: 12, 2: -9, 3: 10 },
    title: 'Mixed structures',
    desc: 'Some words mix diagonals, verticals and curves. The challenge is keeping the whole word rhythmic rather than solving each pair on its own.',
    matters: 'Look at the whole word after every move. Fixing one pair can make the next feel too open or too tight.',
    why: 'Professional spacing is iterative: each local fix still has to add up to a coherent word.',
    tips: ['Move one letter, then look back at the whole word.', 'Match amounts of white space, not numbers.', 'Watch for one gap becoming the thing you notice first.'],
  },
  {
    type: 'kern', word: 'OCEAN', movable: [1, 2, 3], start: { 1: 11, 2: -8, 3: 12 },
    title: 'Round forms',
    desc: 'Round letters have soft, open edges. They need different spacing from straight ones, even at the same width.',
    matters: 'Curves pull away from the edge of their box. Look at the white space around the actual outline.',
    why: 'Spaced mechanically, curves look further apart than stems, and the word goes patchy.',
    tips: ['Compare O–C with C–E as visible spaces.', 'Ignore the boxes entirely.', 'Squint: does the word have one even texture?'],
  },
  {
    type: 'kern', word: 'TYPE', movable: [1, 2], start: { 1: 13, 2: -10 },
    title: 'Display type',
    desc: 'At large sizes, small spacing errors become obvious. Display type needs judging more critically the bigger it gets.',
    matters: 'The bigger the type, the more visible the white space between letters becomes.',
    why: 'Display type is looked at as much as read. Spacing becomes part of the composition.',
    tips: ['Imagine the word on a poster rather than in a paragraph.', 'Look for gaps that feel like holes.', 'Make small corrections once the rhythm is close.'],
  },
  {
    type: 'leading', measure: 31, start: 1.12, min: 1.0, max: 1.9,
    title: 'Leading basics',
    desc: 'Leading separates lines enough to follow comfortably while keeping the paragraph together.',
    matters: 'Too tight and the lines compete. Too loose and the paragraph falls apart into separate strips.',
    why: 'Readers need to find the start of the next line. Vertical rhythm helps, but more space is not automatically better.',
    tips: ['Look at the white bands between lines.', 'Step back and judge the paragraph as one texture.', 'There’s no single right number. You’re aiming for a comfortable range.'],
    sample: 'Good typography rarely calls attention to itself. It creates enough structure for the eye to move, return and continue without having to solve the layout first.',
  },
  {
    type: 'measure', leading: 1.4, start: 26, min: 16, max: 100, band: [50, 75],
    title: 'Measure changes things',
    desc: 'Line length, or measure, decides how far the eye travels before it has to find the next line.',
    matters: 'Too short and the eye keeps jumping back. Too long and it loses its place on the return.',
    why: 'Most comfortable reading sits somewhere around 50 to 75 characters a line. Short and long both tire the reader, in different ways.',
    tips: ['Notice how often your eye returns to the left edge.', 'Count roughly: two to three alphabets a line is a good start.', 'Measure and leading work together: longer lines want more leading.'],
    sample: 'A comfortable line length lets the reader settle into a rhythm. Too short, and the eye is constantly jumping back to the start of the next line before a thought has finished. Too long, and the return journey becomes a search, so readers skip lines or reread them. Somewhere in the middle, reading stops feeling like work.',
  },
  {
    type: 'wordspacing', start: 0.22, min: -0.08, max: 0.32, band: [-0.03, 0.05], falloff: 0.12,
    title: 'Word spacing',
    desc: 'Word spacing decides how clearly words group, without opening distracting rivers through a paragraph.',
    matters: 'Words need enough space to separate, but big gaps break the texture and line up into vertical channels.',
    why: 'Good spacing keeps words distinct and the paragraph an even grey.',
    tips: ['Look for rivers: vertical channels of white running down the paragraph.', 'Compare the space between words with the space inside them.', 'The typeface’s own spacing is usually close. Big changes rarely help.'],
    sample: 'Typography is a system of relationships, not a collection of isolated settings. Word spacing changes the texture of every line, and wide gaps start to line up into rivers that pull the eye down the page instead of along it.',
  },
  {
    type: 'rag', measure: 34,
    title: 'Rag, runts & breaks',
    desc: 'A good block of text depends on the shape of its line endings. Edit the paragraph itself to improve the rag and get rid of weak final lines.',
    matters: 'Watch the right edge. A good rag moves in small, varied steps. A very short last line is a runt and usually deserves attention.',
    why: 'A poor rag makes distracting shapes in the white space. A short last line can usually be fixed by editing a few words.',
    tips: ['Don’t make every line the same length. A natural rag still varies.', 'A very short last line is the strongest signal to rewrite.', 'Edit words, not line breaks. Forced breaks fall apart on other screen sizes.'],
    sample: 'A good typographic rag should feel natural rather than mechanically chopped. Small changes to language can often remove an awkward final line while keeping the paragraph easy to read.',
  },
  {
    type: 'leading', measure: 40, start: 1.7, min: 1.0, max: 1.9,
    title: 'Density vs rhythm',
    desc: 'A good paragraph has texture: enough air to follow the lines, and enough cohesion to still read as one block.',
    matters: 'Leading changes both how easily you follow a line and the overall colour of the paragraph.',
    why: 'The skill is noticing when density starts to get in the way, not memorising a ratio.',
    tips: ['Step back: does it still look like one paragraph?', 'Move closer: can you find the next line easily?', 'If each line feels like a separate object, the leading is too loose.'],
    sample: 'Texture is the grey a paragraph makes when you stop reading it and just look. Set it too tight and the lines crowd into a dark block that is hard to move through. Set it too loose and the paragraph dissolves into stripes, each line floating on its own.',
  },
  { type: 'score', title: 'Final eye test', desc: 'Your eye score: how consistently your decisions landed in the comfortable zone across the lessons you’ve practised.' },
];

export const typeLabel = { kern: 'Kerning', leading: 'Leading', measure: 'Measure', wordspacing: 'Spacing', rag: 'Composition', score: 'Assessment' };
