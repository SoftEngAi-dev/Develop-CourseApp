/* ═══════════════════════════════════════════════════════════════════════════
 * core/validation/schema.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: un validador de datos minimalista con una API en cadena
 *     muy parecida a Zod: `s.object({ name: s.string(), ports: s.array(s.number()) })`.
 *     Comprueba tipos, valores permitidos, campos obligatorios y devuelve
 *     errores con la ruta exacta del campo ("manifest.project.name").
 *     POR QUÉ EXISTE (DEC-00008): la política POL-0005 prohíbe dependencias npm
 *     en el núcleo. Zod es excelente, pero es un paquete externo. Escribimos
 *     ~200 líneas con la misma forma de API para que, si algún día queremos Zod
 *     de verdad, el cambio sea un adaptador de una línea.
 *     ¿Qué pasa si NO validamos? Un manifest.json con una coma de más o un
 *     campo renombrado rompería silenciosamente cada sesión futura. Validar es
 *     lo que convierte "archivos JSON sueltos" en un "contrato".
 *
 * 🇬🇧 EN — WHAT IT DOES: a minimal data validator with a chainable API very
 *     similar to Zod: `s.object({ name: s.string(), ports: s.array(s.number()) })`.
 *     It checks types, allowed values and required fields, and reports errors
 *     with the exact field path ("manifest.project.name").
 *     WHY IT EXISTS (DEC-00008): policy POL-0005 forbids npm dependencies in
 *     the core. Zod is excellent but external. We wrote ~200 lines with the
 *     same API shape so that adopting real Zod later is a one-line adapter.
 *     Without validation, a manifest.json with a renamed field would silently
 *     break every future session. Validation is what turns "loose JSON files"
 *     into "a contract".
 *
 * 🇧🇷 PT — O QUE FAZ: um validador de dados minimalista com API encadeada
 *     muito parecida com Zod: `s.object({ name: s.string(), ports: s.array(s.number()) })`.
 *     Verifica tipos, valores permitidos e campos obrigatórios, e reporta erros
 *     com o caminho exato do campo ("manifest.project.name").
 *     POR QUE EXISTE (DEC-00008): a política POL-0005 proíbe dependências npm
 *     no núcleo. Zod é excelente, mas é externo. Escrevemos ~200 linhas com a
 *     mesma forma de API para que adotar o Zod real depois seja um adaptador de
 *     uma linha. Sem validação, um manifest.json com campo renomeado quebraria
 *     silenciosamente cada sessão futura.
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • ¿Qué es "validar"? ES/EN/PT: comprobar que los datos que recibes tienen
 *     la forma que esperas ANTES de usarlos. Es el cinturón de seguridad del
 *     programa: no evita el accidente, evita que te mate.
 *     Checking incoming data has the expected shape BEFORE using it.
 *   • `typeof x === 'string'` ES/EN/PT: en JavaScript los tipos básicos son
 *     string, number, boolean, undefined, object, function, symbol, bigint.
 *     OJO: `typeof null === 'object'` (un famoso bug histórico del lenguaje),
 *     por eso siempre comprobamos `x === null` por separado.
 *     Careful: typeof null is 'object', a famous historical language bug.
 *   • `Array.isArray(x)` ES/EN/PT: la única forma fiable de saber si algo es
 *     un array, porque `typeof [] === 'object'`. The only reliable array check.
 *   • API en cadena / chainable API ES/EN/PT: cada método devuelve `this`, así
 *     puedes escribir `s.string().min(3).optional()`. Cada llamada devuelve el
 *     mismo objeto modificado. Each method returns this, enabling chaining.
 *   • Cierre léxico / closure ES/EN/PT: una función que "recuerda" las
 *     variables del lugar donde fue creada. Aquí `parse` recuerda `checks`.
 *     A function that remembers variables from where it was created.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** ES/EN/PT: clase base de todos los esquemas. Base class for every schema. */
class Schema {
  constructor(kind) {
    this.kind = kind;
    this._optional = false;
    this._nullable = false;
    this._default = undefined;
    this._hasDefault = false;
    this._checks = [];
  }

  /** ES/EN/PT: el campo puede faltar. The field may be absent. O campo pode faltar. */
  optional() {
    this._optional = true;
    return this;
  }

  /** ES/EN/PT: el campo puede ser null. The field may be null. O campo pode ser null. */
  nullable() {
    this._nullable = true;
    return this;
  }

  /** ES/EN/PT: valor si el campo falta. Value used when the field is absent. Valor se o campo faltar. */
  default(value) {
    this._default = value;
    this._hasDefault = true;
    this._optional = true;
    return this;
  }

  /** ES/EN/PT: añade una comprobación personalizada. Adds a custom check. Adiciona verificação personalizada. */
  refine(fn, message) {
    this._checks.push({ fn, message });
    return this;
  }

  /** @internal */
  _fail(path, message, received) {
    return { ok: false, path, message, received };
  }

  /** @internal */
  _handleAbsent(path) {
    if (this._hasDefault) {
      return { ok: true, value: typeof this._default === 'function' ? this._default() : this._default };
    }
    if (this._optional) return { ok: true, value: undefined };
    return this._fail(path, 'required field is missing', undefined);
  }

  /**
   * ES: valida y devuelve `{ok:true,value}` o `{ok:false,errors:[...]}`.
   * EN: validates and returns `{ok:true,value}` or `{ok:false,errors:[...]}`.
   * PT: valida e devolve `{ok:true,value}` ou `{ok:false,errors:[...]}`.
   */
  safeParse(value, path = '$') {
    if (value === undefined) return this._handleAbsent(path);
    if (value === null) {
      if (this._nullable) return { ok: true, value: null };
      return this._fail(path, 'expected a value but received null', value);
    }
    const result = this._parse(value, path);
    if (!result.ok) return result;
    for (const check of this._checks) {
      if (!check.fn(result.value)) {
        return this._fail(path, check.message ?? 'refinement failed', result.value);
      }
    }
    return { ok: true, value: result.value };
  }

  /** ES/EN/PT: como safeParse pero lanza Error si falla. Like safeParse but throws on failure. */
  parse(value, path = '$') {
    const result = this.safeParse(value, path);
    if (!result.ok) {
      const errors = Array.isArray(result.errors) ? result.errors : [result];
      throw new Error(`Validation failed:\n${errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n')}`);
    }
    return result.value;
  }
}

class StringSchema extends Schema {
  constructor() {
    super('string');
    this._min = null;
    this._max = null;
    this._enum = null;
  }
  min(n) { this._min = n; return this; }
  max(n) { this._max = n; return this; }
  /** ES/EN/PT: restringe a una lista de valores. Restricts to a list of values. */
  oneOf(values) { this._enum = values; return this; }
  _parse(value, path) {
    if (typeof value !== 'string') return this._fail(path, 'expected a string', typeof value);
    if (this._min !== null && value.length < this._min) return this._fail(path, `expected at least ${this._min} characters`, value.length);
    if (this._max !== null && value.length > this._max) return this._fail(path, `expected at most ${this._max} characters`, value.length);
    if (this._enum && !this._enum.includes(value)) return this._fail(path, `expected one of [${this._enum.join(', ')}]`, value);
    return { ok: true, value };
  }
}

class NumberSchema extends Schema {
  constructor() { super('number'); this._int = false; this._min = null; this._max = null; }
  int() { this._int = true; return this; }
  min(n) { this._min = n; return this; }
  max(n) { this._max = n; return this; }
  _parse(value, path) {
    if (typeof value !== 'number' || Number.isNaN(value)) return this._fail(path, 'expected a number', typeof value);
    if (this._int && !Number.isInteger(value)) return this._fail(path, 'expected an integer', value);
    if (this._min !== null && value < this._min) return this._fail(path, `expected >= ${this._min}`, value);
    if (this._max !== null && value > this._max) return this._fail(path, `expected <= ${this._max}`, value);
    return { ok: true, value };
  }
}

class BooleanSchema extends Schema {
  constructor() { super('boolean'); }
  _parse(value, path) {
    if (typeof value !== 'boolean') return this._fail(path, 'expected a boolean', typeof value);
    return { ok: true, value };
  }
}

/**
 * ES: esquema de "cualquier cosa", útil para campos de forma libre (payloads).
 * EN: an "anything goes" schema, useful for free-form fields (payloads).
 * PT: esquema de "qualquer coisa", útil para campos de forma livre (payloads).
 */
class AnySchema extends Schema {
  constructor() { super('any'); }
  _parse(value) { return { ok: true, value }; }
}

class ArraySchema extends Schema {
  constructor(itemSchema) { super('array'); this.item = itemSchema ?? new AnySchema(); this._min = null; }
  min(n) { this._min = n; return this; }
  _parse(value, path) {
    if (!Array.isArray(value)) return this._fail(path, 'expected an array', typeof value);
    if (this._min !== null && value.length < this._min) return this._fail(path, `expected at least ${this._min} items`, value.length);
    const out = [];
    const errors = [];
    value.forEach((item, index) => {
      const result = this.item.safeParse(item, `${path}[${index}]`);
      if (result.ok) out.push(result.value);
      else errors.push(...(result.errors ?? [result]));
    });
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: out };
  }
}

class ObjectSchema extends Schema {
  constructor(shape) {
    super('object');
    this.shape = shape ?? {};
    this._strict = false;
  }
  /** ES/EN/PT: prohíbe campos no declarados. Forbids undeclared fields. Proíbe campos não declarados. */
  strict() { this._strict = true; return this; }
  _parse(value, path) {
    if (typeof value !== 'object' || Array.isArray(value)) return this._fail(path, 'expected an object', Array.isArray(value) ? 'array' : typeof value);
    const out = {};
    const errors = [];
    for (const [key, schema] of Object.entries(this.shape)) {
      const result = schema.safeParse(value[key], path === '$' ? key : `${path}.${key}`);
      if (result.ok) {
        if (result.value !== undefined) out[key] = result.value;
      } else {
        errors.push(...(result.errors ?? [result]));
      }
    }
    if (this._strict) {
      for (const key of Object.keys(value)) {
        if (!(key in this.shape)) errors.push({ ok: false, path: `${path}.${key}`, message: 'unexpected field (strict mode)', received: value[key] });
      }
    }
    if (errors.length) return { ok: false, errors };
    // ES: conservamos los campos no declarados (modo no estricto) para no perder datos.
    // EN: we keep undeclared fields (non-strict mode) so no data is ever lost.
    // PT: mantemos os campos não declarados (modo não estrito) para não perder dados.
    for (const [key, val] of Object.entries(value)) if (!(key in out)) out[key] = val;
    return { ok: true, value: out };
  }
}

/** ES/EN/PT: acepta varios tipos posibles. Accepts several possible types. Aceita vários tipos possíveis. */
class UnionSchema extends Schema {
  constructor(schemas) { super('union'); this.schemas = schemas; }
  _parse(value, path) {
    for (const schema of this.schemas) {
      const result = schema.safeParse(value, path);
      if (result.ok) return result;
    }
    return this._fail(path, `expected one of [${this.schemas.map((s) => s.kind).join(' | ')}]`, typeof value);
  }
}

/** ES/EN/PT: acepta un objeto trilingüe {es,en,pt} o un string simple. Trilingual object or plain string. */
class TrilingualSchema extends Schema {
  constructor({ required = ['en'] } = {}) {
    super('trilingual');
    this.required = required;
  }
  _parse(value, path) {
    if (typeof value === 'string') return { ok: true, value: { es: value, en: value, pt: value } };
    if (typeof value !== 'object' || Array.isArray(value)) return this._fail(path, 'expected a trilingual object {es,en,pt} or a string', typeof value);
    const errors = [];
    for (const lang of this.required) {
      if (typeof value[lang] !== 'string' || value[lang].trim() === '') {
        errors.push({ ok: false, path: `${path}.${lang}`, message: `required language "${lang}" is missing`, received: value[lang] });
      }
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, value };
  }
}

/** ES/EN/PT: punto de entrada público, estilo Zod. Public entry point, Zod style. */
export const s = Object.freeze({
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  any: () => new AnySchema(),
  array: (item) => new ArraySchema(item),
  object: (shape) => new ObjectSchema(shape),
  union: (...schemas) => new UnionSchema(schemas),
  trilingual: (opts) => new TrilingualSchema(opts),
  literal: (expected) => new AnySchema().refine((v) => v === expected, `expected the literal ${JSON.stringify(expected)}`),
});

/* ── Schemas concretos del plano de control / Concrete control-plane schemas ── */

export const ProjectManifestSchema = s.object({
  manifest_version: s.string(),
  project: s.object({
    id: s.string(),
    name: s.string(),
    version: s.string(),
    summary: s.trilingual().optional(),
  }),
  vision: s.object({
    central_rule: s.string(),
    pillars: s.array(s.string()).optional(),
  }),
  architecture: s.object({
    pipeline: s.array(s.string()),
    levels: s.array(s.object({ level: s.number().int(), id: s.string(), path: s.string() })),
    layers: s.array(s.object({ layer: s.number().int(), id: s.string() })),
  }),
});

export const EventSchema = s.object({
  id: s.string(),
  type: s.string(),
  ts: s.string(),
  layer: s.string().nullable().optional(),
  session_id: s.string().nullable().optional(),
  payload: s.any().optional(),
});

export const DecisionTraceSchema = s.object({
  id: s.string(),
  objective: s.union(s.string(), s.trilingual()),
  context: s.string().optional(),
  constraints: s.array(s.string()).optional(),
  alternatives: s.array(s.object({ id: s.string().optional(), option: s.string() })).optional(),
  decision: s.string(),
  justification: s.string().optional(),
  consequence: s.string().optional(),
  status: s.string().oneOf(['proposed', 'approved', 'rejected', 'superseded', 'blocked']).optional(),
});

export default s;
