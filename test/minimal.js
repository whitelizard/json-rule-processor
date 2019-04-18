const { get } = require('lodash/fp');
const { set } = require('lodash');

export const miniMAL = E => {
  // 2 args: eval_ast, 3 args: env_bind

  const evalAst = (ast, env, exprs) => {
    if (exprs) {
      // Return new Env with symbols in ast bound to
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
    if (ast instanceof Array) {
      return ast.map((...a) => EVAL(a[0], env));
    }
    if (typeof ast === 'string') {
      const val = get(env, ast);
      return val !== undefined ? val : E.throw(`${ast} not found`);
    }
    return ast;

    // return ast instanceof Array // list?
    //   ? ast.map((...a) => EVAL(a[0], env)) // list
    //   : typeof ast !== "string" // symbol?
    //   ? ast // ast unchanged
    //   : ast in env // symbol in env?
    //   ? env[ast] // lookup symbol
    //   : E.throw(ast + " not found"); // undefined symbol
  };

  function macroexpand(ast, env) {
    while (ast instanceof Array && ast[0] in env && env[ast[0]].M) {
      ast = env[ast[0]](...ast.slice(1));
    }
    return ast;
  }

  function EVAL(ast, env) {
    while (true) {
      // console.log("EVAL:", ast)
      if (!(ast instanceof Array)) return evalAst(ast, env);

      // apply
      ast = macroexpand(ast, env);
      if (!(ast instanceof Array)) return evalAst(ast, env);

      if (ast[0] === 'def') {
        // update current environment
        const val = EVAL(ast[2], env);
        set(env, ast[1], val);
        // env[ast[1]] = EVAL(ast[2], env);
        return val;
      }
      if (ast[0] === '~') {
        // mark as macro
        const f = EVAL(ast[1], env); // eval regular function
        f.M = 1; // mark as macro
        return f;
      }
      if (ast[0] === '`') {
        // quote (unevaluated)
        return ast[1];
      }
      if (ast[0] === '.-') {
        // get or set attribute
        const el = evalAst(ast.slice(1), env);
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
        const el = evalAst(ast.slice(1), env);

        const x = el[0][el[1]];
        return x.apply(el[0], el.slice(2));
      }
      if (ast[0] === 'try') {
        // try/catch
        try {
          return EVAL(ast[1], env);
        } catch (e) {
          return EVAL(ast[2][2], evalAst([ast[2][1]], env, [e]));
        }
      } else if (ast[0] === 'fn') {
        // define new function (lambda)
        const f = (...a) => EVAL(ast[2], evalAst(ast[1], env, a));
        f.A = [ast[2], env, ast[1]];
        return f;
      }

      // TCO cases
      if (ast[0] === 'let') {
        // new environment with bindings
        env = Object.create(env);
        for (const i in ast[1]) {
          if (i % 2) {
            env[ast[1][i - 1]] = EVAL(ast[1][i], env);
          }
        }
        ast = ast[2];
      } else if (ast[0] === 'do') {
        // multiple forms (for side-effects)
        const el = evalAst(ast.slice(1, ast.length - 1), env);
        ast = ast[ast.length - 1];
      } else if (ast[0] === 'if') {
        // branching conditional
        ast = EVAL(ast[1], env) ? ast[2] : ast[3];
      } else {
        // invoke list form
        const el = evalAst(ast, env);

        const f = el[0];
        if (f.A) {
          ast = f.A[0];
          env = evalAst(f.A[2], f.A[1], el.slice(1));
        } else {
          return f(...el.slice(1));
        }
      }
    }
  }

  E = Object.assign(Object.create(E || this), {
    js: eval,
    eval: (...a) => EVAL(a[0], E),

    // These could all also be interop
    '=': (...a) => a[0] === a[1],
    '<': (...a) => a[0] < a[1],
    '+': (...a) => a[0] + a[1],
    '-': (...a) => a[0] - a[1],
    '*': (...a) => a[0] * a[1],
    '/': (...a) => a[0] / a[1],
    isa: (...a) => a[0] instanceof a[1],
    type: (...a) => typeof a[0],
    new: (...a) => new (a[0].bind(...a))(),
    del: (...a) => delete a[0][a[1]],
    // "list":  (...a) => a,
    // "map":   (...a) => a[1].map(x => a[0](x)),
    throw: (...a) => {
      throw a[0];
    },

    read: (...a) => JSON.parse(a[0]),
    // "slurp": (...a) => require("fs").readFileSync(a[0],"utf8"),
    // "load":  (...a) => EVAL(JSON.parse(require("fs").readFileSync(a[0],"utf8")),E),

    rep: (...a) => JSON.stringify(EVAL(JSON.parse(a[0]), E)),
  });

  // Lib specific
  return E;
};

console.log(evalAst([]));
