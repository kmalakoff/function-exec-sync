// Vendored from serialize-javascript 7.1.1, with feature detection so it runs on the >=0.8 floor.
// Upstream needs Node >=20 only because it generates its UID with crypto.getRandomValues; every
// other 7.x change is portable, so the UID keeps using randombytes and the rest is carried over.

/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/

import randomBytes from 'randombytes';

const hasMap = typeof Map !== 'undefined';
const hasSet = typeof Set !== 'undefined';
const hasURL = typeof URL !== 'undefined';
const hasBigInt = typeof BigInt !== 'undefined';
const isArray = Array.isArray || ((x: unknown) => Object.prototype.toString.call(x) === '[object Array]');

// Object.assign is missing until Node 4, and only the sparse-array branch needs it
const assign =
  Object.assign ||
  ((target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) target[keys[i]] = source[keys[i]];
    return target;
  });

// RegExp.prototype.flags is missing until Node 6; the individual booleans go back to ES3
function regexpFlags(re: RegExp): string {
  if (typeof re.flags === 'string') return re.flags;
  return (re.global ? 'g' : '') + (re.ignoreCase ? 'i' : '') + (re.multiline ? 'm' : '');
}

// Array.from is missing until Node 4, but Map/Set arrive in 0.12, so entries are collected by hand
function mapEntries(map: Map<unknown, unknown>): unknown[][] {
  const out: unknown[][] = [];
  map.forEach((value, key) => {
    out.push([key, value]);
  });
  return out;
}

function setValues(set: Set<unknown>): unknown[] {
  const out: unknown[] = [];
  set.forEach((value) => {
    out.push(value);
  });
  return out;
}

// Generate an internal UID to make the regexp pattern harder to guess.
const UID_LENGTH = 16;
const UID = generateUID();
const PLACE_HOLDER_REGEXP = new RegExp(`(\\\\)?"@__(F|R|D|M|S|A|U|I|B|L)-${UID}-(\\d+)__@"`, 'g');

const IS_NATIVE_CODE_REGEXP = /\{\s*\[native code\]\s*\}/g;
const IS_PURE_FUNCTION = /function.*?\(/;
const IS_ARROW_FUNCTION = /.*?=>.*?/;
const UNSAFE_CHARS_REGEXP = /[<>/\u2028\u2029]/g;
// Matches a script end tag (case-insensitive) for XSS protection: either a full `</script...>` tag,
// or a bare `</script` followed by a character the HTML tokenizer treats as ending the tag name.
const SCRIPT_CLOSE_REGEXP = /<\/script[^>]*>|<\/script(?=[\t\n\f\r /><])/gi;

const RESERVED_SYMBOLS = ['*', 'async'];

// Mapping of unsafe HTML and invalid JavaScript line terminator chars to their
// Unicode char counterparts which are safe to use in JavaScript strings.
const ESCAPED_CHARS: Record<string, string> = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

function escapeUnsafeChars(unsafeChar: string): string {
  return ESCAPED_CHARS[unsafeChar];
}

// Roughly matches string literals, template literals, regex literals and comments, so a script-close
// sequence inside one can be escaped differently from one in plain code. A heuristic, not a parser.
const STRING_OR_COMMENT_REGEXP = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n])+\//g;

// Escape a function body for XSS protection while preserving arrow syntax, comparison operators and
// regex literals: only script end tags and line terminators are escaped.
function escapeFunctionBody(str: string): string {
  const stringAndCommentSpans: number[][] = [];
  let match: RegExpExecArray | null;
  STRING_OR_COMMENT_REGEXP.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: exec-loop is the documented RegExp idiom
  while ((match = STRING_OR_COMMENT_REGEXP.exec(str))) {
    stringAndCommentSpans.push([match.index, match.index + match[0].length]);
  }

  // Matches and spans are both in increasing offset order, so one forward cursor classifies every
  // match in O(n) instead of rescanning the spans each time.
  let spanCursor = 0;

  let out = str.replace(SCRIPT_CLOSE_REGEXP, (scriptCloseMatch: string, offset: number) => {
    while (spanCursor < stringAndCommentSpans.length && stringAndCommentSpans[spanCursor][1] <= offset) {
      spanCursor++;
    }
    const span = stringAndCommentSpans[spanCursor];
    const inStringOrComment = !!span && offset >= span[0] && offset < span[1];
    if (!inStringOrComment) {
      // In plain code `<` and `/` may be real tokens, so they cannot be rewritten as unicode escapes
      // without breaking syntax. A space is a no-op that still breaks up the `</script` sequence.
      return `< ${scriptCloseMatch.slice(1)}`;
    }
    // Inside a string/template/regex/comment the characters must survive exactly, so escape instead.
    return scriptCloseMatch.replace(/</g, '\\u003C').replace(/\//g, '\\u002F').replace(/>/g, '\\u003E');
  });
  out = out.replace(/\u2028/g, '\\u2028');
  out = out.replace(/\u2029/g, '\\u2029');
  return out;
}

function generateUID(): string {
  const bytes = randomBytes(UID_LENGTH);
  let result = '';
  for (let i = 0; i < UID_LENGTH; ++i) {
    result += bytes[i].toString(16);
  }
  return result;
}

function deleteFunctions(obj: Record<string, unknown>): void {
  const functionKeys: string[] = [];
  for (const key in obj) {
    if (typeof obj[key] === 'function') {
      functionKeys.push(key);
    }
  }
  for (let i = 0; i < functionKeys.length; i++) {
    delete obj[functionKeys[i]];
  }
}

interface SerializeOptions {
  space?: number | string;
  isJSON?: boolean;
  unsafe?: boolean;
  ignoreFunction?: boolean;
}

export default function serialize(obj: unknown, options?: SerializeOptions | number | string): string {
  let opts: SerializeOptions = {};
  if (options) {
    // Backwards-compatibility for `space` as the second argument.
    if (typeof options === 'number' || typeof options === 'string') {
      opts = { space: options };
    } else {
      opts = options;
    }
  }

  const functions: ((...args: unknown[]) => unknown)[] = [];
  const regexps: RegExp[] = [];
  const dates: Date[] = [];
  const maps: Map<unknown, unknown>[] = [];
  const sets: Set<unknown>[] = [];
  const arrays: unknown[][] = [];
  const undefs: undefined[] = [];
  const infinities: number[] = [];
  const bigInts: bigint[] = [];
  const urls: URL[] = [];

  // Returns placeholders for functions and regexps (identified by index)
  // which are later replaced by their string representation.
  function replacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
    // For nested function
    if (opts.ignoreFunction) {
      deleteFunctions(value as Record<string, unknown>);
    }

    if (hasBigInt && !value && value !== undefined && value !== BigInt(0)) {
      return value;
    }

    // If the value is an object w/ a toJSON method, toJSON is called before
    // the replacer runs, so we use this[key] to get the non-toJSONed value.
    const origValue = this[key];
    const type = typeof origValue;

    if (type === 'object') {
      if (origValue instanceof RegExp) {
        return `@__R-${UID}-${regexps.push(origValue) - 1}__@`;
      }

      if (origValue instanceof Date) {
        return `@__D-${UID}-${dates.push(origValue) - 1}__@`;
      }

      if (hasMap && origValue instanceof Map) {
        return `@__M-${UID}-${maps.push(origValue) - 1}__@`;
      }

      if (hasSet && origValue instanceof Set) {
        return `@__S-${UID}-${sets.push(origValue) - 1}__@`;
      }

      if (isArray(origValue)) {
        const isSparse = (origValue as unknown[]).filter(() => true).length !== (origValue as unknown[]).length;
        if (isSparse) {
          return `@__A-${UID}-${arrays.push(origValue as unknown[]) - 1}__@`;
        }
      }

      if (hasURL && origValue instanceof URL) {
        return `@__L-${UID}-${urls.push(origValue) - 1}__@`;
      }
    }

    if (type === 'function') {
      return `@__F-${UID}-${functions.push(origValue as (...args: unknown[]) => unknown) - 1}__@`;
    }

    if (type === 'undefined') {
      return `@__U-${UID}-${undefs.push(origValue as undefined) - 1}__@`;
    }

    if (type === 'number' && !Number.isNaN(origValue as number) && !Number.isFinite(origValue as number)) {
      return `@__I-${UID}-${infinities.push(origValue as number) - 1}__@`;
    }

    if (type === 'bigint') {
      return `@__B-${UID}-${bigInts.push(origValue as bigint) - 1}__@`;
    }

    return value;
  }

  function serializeFunc(fn: (...args: unknown[]) => unknown, funcOptions: SerializeOptions): string {
    let serializedFn = fn.toString();
    if (IS_NATIVE_CODE_REGEXP.test(serializedFn)) {
      throw new TypeError(`Serializing native function: ${fn.name}`);
    }

    // Escape unsafe HTML characters in function body for XSS protection
    if (funcOptions && funcOptions.unsafe !== true) {
      serializedFn = escapeFunctionBody(serializedFn);
    }

    // pure functions, example: {key: function() {}}
    if (IS_PURE_FUNCTION.test(serializedFn)) {
      return serializedFn;
    }

    // arrow functions, example: arg1 => arg1+5
    if (IS_ARROW_FUNCTION.test(serializedFn)) {
      return serializedFn;
    }

    const argsStartsAt = serializedFn.indexOf('(');
    const def = serializedFn
      .substr(0, argsStartsAt)
      .trim()
      .split(' ')
      .filter((val) => val.length > 0);

    const nonReservedSymbols = def.filter((val) => RESERVED_SYMBOLS.indexOf(val) === -1);

    // enhanced literal objects, example: {key() {}}
    if (nonReservedSymbols.length > 0) {
      return `${def.indexOf('async') > -1 ? 'async ' : ''}function${def.join('').indexOf('*') > -1 ? '*' : ''}${serializedFn.substr(argsStartsAt)}`;
    }

    // arrow functions
    return serializedFn;
  }

  // Check if the parameter is function
  let objToSerialize = obj;
  if (opts.ignoreFunction && typeof objToSerialize === 'function') {
    objToSerialize = undefined;
  }
  // Protects against `JSON.stringify()` returning `undefined`, by serializing
  // to the literal string: "undefined".
  if (objToSerialize === undefined) {
    return String(objToSerialize);
  }

  let str: string | undefined;

  // Creates a JSON string representation of the value.
  // NOTE: Node 0.12 goes into slow mode with extra JSON.stringify() args.
  if (opts.isJSON && !opts.space) {
    str = JSON.stringify(objToSerialize);
  } else {
    str = JSON.stringify(objToSerialize, (opts.isJSON ? null : replacer) as unknown as undefined, opts.space);
  }

  // Protects against `JSON.stringify()` returning `undefined`, by serializing
  // to the literal string: "undefined".
  if (typeof str !== 'string') {
    return String(str);
  }

  // Replace unsafe HTML and invalid JavaScript line terminator chars with
  // their safe Unicode char counterpart. This _must_ happen before the
  // regexps and functions are serialized and added back to the string.
  if (opts.unsafe !== true) {
    str = str.replace(UNSAFE_CHARS_REGEXP, escapeUnsafeChars);
  }

  if (functions.length === 0 && regexps.length === 0 && dates.length === 0 && maps.length === 0 && sets.length === 0 && arrays.length === 0 && undefs.length === 0 && infinities.length === 0 && bigInts.length === 0 && urls.length === 0) {
    return str;
  }

  // Replaces all occurrences of function, regexp, date, map and set placeholders in the
  // JSON string with their string representations. If the original value can
  // not be found, then `undefined` is used.
  return str.replace(PLACE_HOLDER_REGEXP, (match, backSlash, type, valueIndex) => {
    // The placeholder may not be preceded by a backslash. This is to prevent
    // replacing things like `"a\"@__R-<UID>-0__@"` and thus outputting
    // invalid JS.
    if (backSlash) {
      return match;
    }

    if (type === 'D') {
      // Validate the ISO string to prevent code injection through a spoofed toISOString()
      const isoStr = String(dates[valueIndex].toISOString());
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(isoStr)) {
        throw new TypeError('Invalid Date ISO string');
      }
      return `new Date("${isoStr}")`;
    }

    if (type === 'R') {
      // Sanitize flags to prevent code injection (only valid RegExp flag characters survive)
      const flags = String(regexpFlags(regexps[valueIndex])).replace(/[^gimsuydv]/g, '');
      const regexpSource = regexps[valueIndex].source;
      if (typeof regexpSource !== 'string') {
        throw new TypeError('RegExp.source must be a string');
      }
      return `new RegExp(${serialize(regexpSource)}, "${flags}")`;
    }

    if (type === 'M') {
      return `new Map(${serialize(mapEntries(maps[valueIndex]), opts)})`;
    }

    if (type === 'S') {
      return `new Set(${serialize(setValues(sets[valueIndex]), opts)})`;
    }

    if (type === 'A') {
      return `Array.prototype.slice.call(${serialize(assign({ length: arrays[valueIndex].length }, arrays[valueIndex] as unknown as Record<string, unknown>), opts)})`;
    }

    if (type === 'U') {
      return 'undefined';
    }

    if (type === 'I') {
      return String(infinities[valueIndex]);
    }

    if (type === 'B') {
      return `BigInt("${bigInts[valueIndex]}")`;
    }

    if (type === 'L') {
      const urlStr = urls[valueIndex].toString();
      if (typeof urlStr !== 'string') {
        throw new TypeError('URL.toString() must return a string');
      }
      return `new URL(${serialize(urlStr, opts)})`;
    }

    const fn = functions[valueIndex];

    return serializeFunc(fn, opts);
  });
}
