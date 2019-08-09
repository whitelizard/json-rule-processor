const { get } = require('lodash/fp');
const { set } = require('lodash');

function expand(ast, env) {
  if (!Array.isArray(ast)) return ast;
  const [cmd, ...args] = ast;
  const { [cmd]: func } = env;
  if (func === undefined) return ast;
  const { M } = func;
  if (M === undefined) return ast;
  return expand(func(...args));

  // while (Array.isArray(ast) && ast[0] in env && env[ast[0]].M) {
  //   ast = env[cmd](...args);
  // }
  // return ast;
}

const evalAst = (ast, env, exprs) => {
  if (exprs) {
    // Return new env with symbols in ast bound to
    // corresponding values in exprs
    env = Object.create(env);
    ast.some((a, i) => {
      if (a === '&') env[ast[i + 1]] = exprs.slice(i);
      env[a] = exprs[i];
      return undefined;
    });
    return env;
  }
  // Evaluate the form/ast
  if (Array.isArray(ast)) {
    return ast.map(a => evaluate(a, env));
  }
  if (typeof ast === 'string') {
    const val = get(env, ast);
    return val !== undefined ? val : env.throw(`${ast} not found`);
  }
  return ast;

  // return Array.isArray(ast) // list?
  //   ? ast.map((...a) => evaluate(a[0], ctx)) // list
  //   : typeof ast !== "string" // symbol?
  //   ? ast // ast unchanged
  //   : ast in ctx // symbol in ctx?
  //   ? ctx[ast] // lookup symbol
  //   : E.throw(ast + " not found"); // undefined symbol
};

// 2 args: eval_ast, 3 args: env_bind
function evaluate(ast, ctx) {
  while (true) {
    // console.log("evaluate:", ast)
    if (!Array.isArray(ast)) return evalAst(ast, ctx);

    // apply
    ast = expand(ast, ctx);
    if (!Array.isArray(ast)) return evalAst(ast, ctx);

    if (ast[0] === 'def') {
      // update current environment (ctx)
      const val = evaluate(ast[2], ctx);
      set(ctx, ast[1], val);
      // ctx[ast[1]] = evaluate(ast[2], ctx);
      return val;
    }
    if (ast[0] === '~') {
      // mark as macro
      const f = evaluate(ast[1], ctx); // eval regular function
      f.M = 1; // mark as macro
      return f;
    }
    if (ast[0] === '`') {
      // quote (unevaluated)
      return ast[1];
    }
    if (ast[0] === '.-') {
      // get or set attribute
      const el = evalAst(ast.slice(1), ctx);
      const x = el[0][el[1]];
      if (2 in el) {
        const [, , y] = el;
        el[0][el[1]] = y;
        return y;
      }
      return x;
      // return 2 in el ? (el[0][el[1]] = el[2]) : x;
    }
    if (ast[0] === '.') {
      // call object method
      const el = evalAst(ast.slice(1), ctx);

      const x = el[0][el[1]];
      return x.apply(el[0], el.slice(2));
    }
    if (ast[0] === 'try') {
      // try/catch
      try {
        return evaluate(ast[1], ctx);
      } catch (e) {
        return evaluate(ast[2][2], evalAst([ast[2][1]], ctx, [e]));
      }
    } else if (ast[0] === 'fn') {
      // define new function (lambda)
      const f = (...a) => evaluate(ast[2], evalAst(ast[1], ctx, a));
      f.A = [ast[2], ctx, ast[1]];
      return f;
    }

    // TCO cases
    const [cmd, arg1, arg2, arg3] = ast;
    if (cmd === 'let') {
      // new environment with bindings (ctx)
      ctx = Object.create(ctx);
      for (const i in arg1) {
        if (i % 2) {
          ctx[arg1[i - 1]] = evaluate(arg1[i], ctx);
        }
      }
      ast = arg2;
    } else if (cmd === 'do') {
      // multiple forms (for side-effects)
      const el = evalAst(ast.slice(1, ast.length - 1), ctx);
      ast = ast[ast.length - 1];
    } else if (cmd === 'if') {
      // branching conditional
      ast = evaluate(arg1, ctx) ? arg2 : arg3;
    } else {
      // invoke list form
      const el = evalAst(ast, ctx);
      const [f] = el;
      const { A } = f;
      if (A) {
        const [args] = A;
        ast = args;
        ctx = evalAst(f.A[2], f.A[1], el.slice(1));
      } else {
        return f(...el.slice(1));
      }
    }
  }
}

export const createJispParser = env => {
  const obj = Object.assign(Object.create({ ...env, constructor: createJispParser }), {
    js: eval, // eslint-disable-line
    // These could all also be interop
    '=': (a, b) => a === b,
    '<': (a, b) => a < b,
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
    // isa: (...a) => a[0] instanceof a[1],
    typeof: a => typeof a,
    new: (...a) => new (a[0].bind(...a))(),
    // del: (...a) => delete a[0][a[1]],
    // "list":  (...a) => a,
    // "map":   (...a) => a[1].map(x => a[0](x)),
    throw: a => {
      throw a;
    },
    read: a => JSON.parse(a),
  });

  // "slurp": (...a) => require("fs").readFileSync(a[0],"utf8"),
  // "load":  (...a) => evaluate(JSON.parse(require("fs").readFileSync(a[0],"utf8")),E),
  obj.rep = a => JSON.stringify(evaluate(JSON.parse(a), obj));
  obj.eval = a => evaluate(a, obj);
  return obj;
};

console.log(evalAst([]));
