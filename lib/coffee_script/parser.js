(function(){
  var Parser, __a, __b, __c, __d, __e, __f, bnf, grammar, name, non_terminal, o, operators, option, parser, part, tokens, unwrap;
  var __hasProp = Object.prototype.hasOwnProperty;
  Parser = require('jison').Parser;
  process.mixin(require('./nodes'));
  // DSL ===================================================================
  // Detect functions: [
  unwrap = /function\s*\(\)\s*\{\s*return\s*([\s\S]*);\s*\}/;
  // Quickie DSL for Jison access.
  o = function o(pattern_string, func) {
    var match;
    if (func) {
      func = (match = (func + "").match(unwrap)) ? match[1] : '(' + func + '())';
      return [pattern_string, '$$ = ' + func + ';'];
    } else {
      return [pattern_string, '$$ = $1;'];
    }
  };
  // Precedence ===========================================================
  operators = [["left", '?'], ["right", 'NOT', '!', '!!', '~', '++', '--'], ["left", '*', '/', '%'], ["left", '+', '-'], ["left", '<<', '>>', '>>>'], ["left", '&', '|', '^'], ["left", '<=', '<', '>', '>='], ["right", '==', '!=', 'IS', 'ISNT'], ["left", '&&', '||', 'AND', 'OR'], ["right", '-=', '+=', '/=', '*=', '%='], ["right", 'DELETE', 'INSTANCEOF', 'TYPEOF'], ["left", '.'], ["right", 'INDENT'], ["left", 'OUTDENT'], ["right", 'WHEN', 'LEADING_WHEN', 'IN', 'OF', 'BY'], ["right", 'THROW', 'FOR', 'NEW', 'SUPER'], ["left", 'EXTENDS'], ["left", '||=', '&&=', '?='], ["right", 'ASSIGN', 'RETURN'], ["right", '->', '=>', 'UNLESS', 'IF', 'ELSE', 'WHILE']];
  // Grammar ==============================================================
  grammar = {
    // All parsing will end in this rule, being the trunk of the AST.
    Root: [o("", function() {
        return new Expressions();
      }), o("TERMINATOR", function() {
        return new Expressions();
      }), o("Expressions"), o("Block TERMINATOR")
    ],
    // Any list of expressions or method body, seperated by line breaks or semis.
    Expressions: [o("Expression", function() {
        return Expressions.wrap([$1]);
      }), o("Expressions TERMINATOR Expression", function() {
        return $1.push($3);
      }), o("Expressions TERMINATOR")
    ],
    // All types of expressions in our language. The basic unit of CoffeeScript
    // is the expression.
    Expression: [o("Value"), o("Call"), o("Code"), o("Operation"), o("Assign"), o("If"), o("Try"), o("Throw"), o("Return"), o("While"), o("For"), o("Switch"), o("Extends"), o("Splat"), o("Existence"), o("Comment")],
    // A block of expressions. Note that the Rewriter will convert some postfix
    // forms into blocks for us, by altering the token stream.
    Block: [o("INDENT Expressions OUTDENT", function() {
        return $2;
      }), o("INDENT OUTDENT", function() {
        return new Expressions();
      })
    ],
    // All hard-coded values. These can be printed straight to JavaScript.
    Literal: [o("NUMBER", function() {
        return new LiteralNode(yytext);
      }), o("STRING", function() {
        return new LiteralNode(yytext);
      }), o("JS", function() {
        return new LiteralNode(yytext);
      }), o("REGEX", function() {
        return new LiteralNode(yytext);
      }), o("BREAK", function() {
        return new LiteralNode(yytext);
      }), o("CONTINUE", function() {
        return new LiteralNode(yytext);
      }), o("ARGUMENTS", function() {
        return new LiteralNode(yytext);
      }), o("TRUE", function() {
        return new LiteralNode(true);
      }), o("FALSE", function() {
        return new LiteralNode(false);
      }), o("YES", function() {
        return new LiteralNode(true);
      }), o("NO", function() {
        return new LiteralNode(false);
      }), o("ON", function() {
        return new LiteralNode(true);
      }), o("OFF", function() {
        return new LiteralNode(false);
      })
    ],
    // Assignment to a variable (or index).
    Assign: [o("Value ASSIGN Expression", function() {
        return new AssignNode($1, $3);
      })
    ],
    // Assignment within an object literal (can be quoted).
    AssignObj: [o("IDENTIFIER ASSIGN Expression", function() {
        return new AssignNode(new ValueNode(yytext), $3, 'object');
      }), o("STRING ASSIGN Expression", function() {
        return new AssignNode(new ValueNode(new LiteralNode(yytext)), $3, 'object');
      }), o("NUMBER ASSIGN Expression", function() {
        return new AssignNode(new ValueNode(new LiteralNode(yytext)), $3, 'object');
      }), o("Comment")
    ],
    // A return statement.
    Return: [o("RETURN Expression", function() {
        return new ReturnNode($2);
      }), o("RETURN", function() {
        return new ReturnNode(new ValueNode(new LiteralNode('null')));
      })
    ],
    // A comment.
    Comment: [o("COMMENT", function() {
        return new CommentNode(yytext);
      })
    ],
    //
    // # Arithmetic and logical operators
    // # For Ruby's Operator precedence, see: [
    // # https://www.cs.auckland.ac.nz/references/ruby/ProgrammingRuby/language.html
    // Operation: [
    //   o "! Expression",                           -> new OpNode($1, $2)
    //   o "!! Expression",                          -> new OpNode($1, $2)
    //   o "- Expression",                           -> new OpNode($1, $2)
    //   o "+ Expression",                           -> new OpNode($1, $2)
    //   o "NOT Expression",                         -> new OpNode($1, $2)
    //   o "~ Expression",                           -> new OpNode($1, $2)
    //   o "-- Expression",                          -> new OpNode($1, $2)
    //   o "++ Expression",                          -> new OpNode($1, $2)
    //   o "DELETE Expression",                      -> new OpNode($1, $2)
    //   o "TYPEOF Expression",                      -> new OpNode($1, $2)
    //   o "Expression --",                          -> new OpNode($2, $1, null, true)
    //   o "Expression ++",                          -> new OpNode($2, $1, null, true)
    //
    //   o "Expression * Expression",                -> new OpNode($2, $1, $3)
    //   o "Expression / Expression",                -> new OpNode($2, $1, $3)
    //   o "Expression % Expression",                -> new OpNode($2, $1, $3)
    //
    //   o "Expression + Expression",                -> new OpNode($2, $1, $3)
    //   o "Expression - Expression",                -> new OpNode($2, $1, $3)
    //
    //   o "Expression << Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression >> Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression >>> Expression",              -> new OpNode($2, $1, $3)
    //
    //   o "Expression & Expression",                -> new OpNode($2, $1, $3)
    //   o "Expression | Expression",                -> new OpNode($2, $1, $3)
    //   o "Expression ^ Expression",                -> new OpNode($2, $1, $3)
    //
    //   o "Expression <= Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression < Expression",                -> new OpNode($2, $1, $3)
    //   o "Expression > Expression",                -> new OpNode($2, $1, $3)
    //   o "Expression >= Expression",               -> new OpNode($2, $1, $3)
    //
    //   o "Expression == Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression != Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression IS Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression ISNT Expression",             -> new OpNode($2, $1, $3)
    //
    //   o "Expression && Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression || Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression AND Expression",              -> new OpNode($2, $1, $3)
    //   o "Expression OR Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression ? Expression",                -> new OpNode($2, $1, $3)
    //
    //   o "Expression -= Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression += Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression /= Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression *= Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression %= Expression",               -> new OpNode($2, $1, $3)
    //   o "Expression ||= Expression",              -> new OpNode($2, $1, $3)
    //   o "Expression &&= Expression",              -> new OpNode($2, $1, $3)
    //   o "Expression ?= Expression",               -> new OpNode($2, $1, $3)
    //
    //   o "Expression INSTANCEOF Expression",       -> new OpNode($2, $1, $3)
    //   o "Expression IN Expression",               -> new OpNode($2, $1, $3)
    // ]
    // The existence operator.
    Existence: [o("Expression ?", function() {
        return new ExistenceNode($1);
      })
    ],
    // Function definition.
    Code: [o("PARAM_START ParamList PARAM_END FuncGlyph Block", function() {
        return new CodeNode($2, $5, $4);
      }), o("FuncGlyph Block", function() {
        return new CodeNode([], $2, $1);
      })
    ],
    // The symbols to signify functions, and bound functions.
    FuncGlyph: [o("->", function() {
        return 'func';
      }), o("=>", function() {
        return 'boundfunc';
      })
    ],
    // The parameters to a function definition.
    ParamList: [o("Param", function() {
        return [$1];
      }), o("ParamList , Param", function() {
        return $1.push($3);
      })
    ],
    // A Parameter (or ParamSplat) in a function definition.
    Param: [o("PARAM", function() {
        return yytext;
      }), o("PARAM . . .", function() {
        return new SplatNode(yytext);
      })
    ],
    // A regular splat.
    Splat: [o("Expression . . .", function() {
        return new SplatNode($1);
      })
    ],
    // Expressions that can be treated as values.
    Value: [o("IDENTIFIER", function() {
        return new ValueNode(yytext);
      }), o("Literal", function() {
        return new ValueNode($1);
      }), o("Array", function() {
        return new ValueNode($1);
      }), o("Object", function() {
        return new ValueNode($1);
      }), o("Parenthetical", function() {
        return new ValueNode($1);
      }), o("Range", function() {
        return new ValueNode($1);
      }), o("Value Accessor", function() {
        return $1.push($2);
      }), o("Invocation Accessor", function() {
        return new ValueNode($1, [$2]);
      })
    ],
    // Accessing into an object or array, through dot or index notation.
    Accessor: [o("PROPERTY_ACCESS IDENTIFIER", function() {
        return new AccessorNode(yytext);
      }), o("PROTOTYPE_ACCESS IDENTIFIER", function() {
        return new AccessorNode(yytext, 'prototype');
      }), o("SOAK_ACCESS IDENTIFIER", function() {
        return new AccessorNode(yytext, 'soak');
      }), o("Index"), o("Slice", function() {
        return new SliceNode($1);
      })
    ],
    // Indexing into an object or array.
    Index: [o("INDEX_START Expression INDEX_END", function() {
        return new IndexNode($2);
      })
    ],
    // An object literal.
    Object: [o("{ AssignList }", function() {
        return new ObjectNode($2);
      })
    ],
    // Assignment within an object literal (comma or newline separated).
    AssignList: [o("", function() {
        return [];
      }), o("AssignObj", function() {
        return [$1];
      }), o("AssignList , AssignObj", function() {
        return $1.push($3);
      }), o("AssignList TERMINATOR AssignObj", function() {
        return $1.push($3);
      }), o("AssignList , TERMINATOR AssignObj", function() {
        return $1.push($4);
      }), o("INDENT AssignList OUTDENT", function() {
        return $2;
      })
    ],
    // All flavors of function call (instantiation, super, and regular).
    Call: [o("Invocation", function() {
        return $1;
      }), o("NEW Invocation", function() {
        return $2.new_instance();
      }), o("Super", function() {
        return $1;
      })
    ],
    // Extending an object's prototype.
    Extends: [o("Value EXTENDS Value", function() {
        return new ExtendsNode($1, $3);
      })
    ],
    // A generic function invocation.
    Invocation: [o("Value Arguments", function() {
        return new CallNode($1, $2);
      }), o("Invocation Arguments", function() {
        return new CallNode($1, $2);
      })
    ],
    // The list of arguments to a function invocation.
    Arguments: [o("CALL_START ArgList CALL_END", function() {
        return $2;
      })
    ],
    // Calling super.
    Super: [o("SUPER CALL_START ArgList CALL_END", function() {
        return new CallNode('super', $3);
      })
    ],
    // The range literal.
    Range: [o("[ Expression . . Expression ]", function() {
        return new RangeNode($2, $5);
      }), o("[ Expression . . . Expression ]", function() {
        return new RangeNode($2, $6, true);
      })
    ],
    // The slice literal.
    Slice: [o("INDEX_START Expression . . Expression INDEX_END", function() {
        return new RangeNode($2, $5);
      }), o("INDEX_START Expression . . . Expression INDEX_END", function() {
        return new RangeNode($2, $6, true);
      })
    ],
    // The array literal.
    Array: [o("[ ArgList ]", function() {
        return new ArrayNode($2);
      })
    ],
    // A list of arguments to a method call, or as the contents of an array.
    ArgList: [o("", function() {
        return [];
      }), o("Expression", function() {
        return val;
      }), o("INDENT Expression", function() {
        return [$2];
      }), o("ArgList , Expression", function() {
        return $1.push($3);
      }), o("ArgList TERMINATOR Expression", function() {
        return $1.push($3);
      }), o("ArgList , TERMINATOR Expression", function() {
        return $1.push($4);
      }), o("ArgList , INDENT Expression", function() {
        return $1.push($4);
      }), o("ArgList OUTDENT", function() {
        return $1;
      })
    ],
    // Just simple, comma-separated, required arguments (no fancy syntax).
    SimpleArgs: [o("Expression", function() {
        return $1;
      }), o("SimpleArgs , Expression", function() {
        return ([$1].push($3)).reduce(function(a, b) {
          return a.concat(b);
        });
      })
    ],
    // Try/catch/finally exception handling blocks.
    Try: [o("TRY Block Catch", function() {
        return new TryNode($2, $3[0], $3[1]);
      }), o("TRY Block FINALLY Block", function() {
        return new TryNode($2, null, null, $4);
      }), o("TRY Block Catch FINALLY Block", function() {
        return new TryNode($2, $3[0], $3[1], $5);
      })
    ],
    // A catch clause.
    Catch: [o("CATCH IDENTIFIER Block", function() {
        return [$2, $3];
      })
    ],
    // Throw an exception.
    Throw: [o("THROW Expression", function() {
        return new ThrowNode($2);
      })
    ],
    // Parenthetical expressions.
    Parenthetical: [o("( Expression )", function() {
        return new ParentheticalNode($2);
      })
    ],
    // The while loop. (there is no do..while).
    While: [o("WHILE Expression Block", function() {
        return new WhileNode($2, $3);
      }), o("WHILE Expression", function() {
        return new WhileNode($2, null);
      }), o("Expression WHILE Expression", function() {
        return new WhileNode($3, Expressions.wrap([$1]));
      })
    ],
    // Array comprehensions, including guard and current index.
    // Looks a little confusing, check nodes.rb for the arguments to ForNode.
    For: [o("Expression FOR ForVariables ForSource", function() {
        return new ForNode($1, $4, $3[0], $3[1]);
      }), o("FOR ForVariables ForSource Block", function() {
        return new ForNode($4, $3, $2[0], $2[1]);
      })
    ],
    // An array comprehension has variables for the current element and index.
    ForVariables: [o("IDENTIFIER", function() {
        return [$1];
      }), o("IDENTIFIER , IDENTIFIER", function() {
        return [$1, $3];
      })
    ],
    // The source of the array comprehension can optionally be filtered.
    ForSource: [o("IN Expression", function() {
        return {
          source: $2
        };
      }), o("OF Expression", function() {
        return {
          source: $2,
          object: true
        };
      }), o("ForSource WHEN Expression", function() {
        $1.filter = $3;
        return $1;
      }), o("ForSource BY Expression", function() {
        $1.step = $3;
        return $1;
      })
    ],
    // Switch/When blocks.
    Switch: [o("SWITCH Expression INDENT Whens OUTDENT", function() {
        return $4.rewrite_condition($2);
      }), o("SWITCH Expression INDENT Whens ELSE Block OUTDENT", function() {
        return $4.rewrite_condition($2).add_else($6);
      })
    ],
    // The inner list of whens.
    Whens: [o("When", function() {
        return $1;
      }), o("Whens When", function() {
        return $1.push($2);
      })
    ],
    // An individual when.
    When: [o("LEADING_WHEN SimpleArgs Block", function() {
        return new IfNode($2, $3, null, {
          statement: true
        });
      }), o("LEADING_WHEN SimpleArgs Block TERMINATOR", function() {
        return new IfNode($2, $3, null, {
          statement: true
        });
      }), o("Comment TERMINATOR When", function() {
        return $3.add_comment($1);
      })
    ],
    // The most basic form of "if".
    IfBlock: [o("IF Expression Block", function() {
        return new IfNode($2, $3);
      })
    ],
    // An elsif portion of an if-else block.
    ElsIf: [o("ELSE IfBlock", function() {
        return $2.force_statement();
      })
    ],
    // Multiple elsifs can be chained together.
    ElsIfs: [o("ElsIf", function() {
        return $1;
      }), o("ElsIfs ElsIf", function() {
        return $1.add_else($2);
      })
    ],
    // Terminating else bodies are strictly optional.
    ElseBody: [o("", function() {
        return null;
      }), o("ELSE Block", function() {
        return $2;
      })
    ],
    // All the alternatives for ending an if-else block.
    IfEnd: [o("ElseBody", function() {
        return $1;
      }), o("ElsIfs ElseBody", function() {
        return $1.add_else($2);
      })
    ],
    // The full complement of if blocks, including postfix one-liner ifs and unlesses.
    If: [o("IfBlock IfEnd", function() {
        return $1.add_else($2);
      }), o("Expression IF Expression", function() {
        return new IfNode($3, Expressions.wrap([$1]), null, {
          statement: true
        });
      }), o("Expression UNLESS Expression", function() {
        return new IfNode($3, Expressions.wrap([$1]), null, {
          statement: true,
          invert: true
        });
      })
    ]
  };
  // Helpers ==============================================================
  // Make the Jison parser.
  bnf = {
  };
  tokens = [];
  __a = grammar;
  for (name in __a) {
    non_terminal = __a[name];
    if (__hasProp.call(__a, name)) {
      bnf[name] = (function() {
        __b = []; __c = non_terminal;
        for (__d = 0; __d < __c.length; __d++) {
          option = __c[__d];
          __b.push((function() {
            __e = option[0].split(" ");
            for (__f = 0; __f < __e.length; __f++) {
              part = __e[__f];
              !grammar[part] ? tokens.push(part) : null;
            }
            name === "Root" ? (option[1] = "return " + option[1]) : null;
            return option;
          }).call(this));
        }
        return __b;
      }).call(this);
    }
  }
  tokens = tokens.join(" ");
  parser = new Parser({
    tokens: tokens,
    bnf: bnf,
    operators: operators,
    startSymbol: 'Root'
  }, {
    debug: false
  });
  // Thin wrapper around the real lexer
  parser.lexer = {
    lex: function lex() {
      var token;
      token = this.tokens[this.pos] || [""];
      this.pos += 1;
      this.yylineno = token[2];
      this.yytext = token[1];
      return token[0];
    },
    setInput: function setInput(tokens) {
      this.tokens = tokens;
      return this.pos = 0;
    },
    upcomingInput: function upcomingInput() {
      return "";
    },
    showPosition: function showPosition() {
      return this.pos;
    }
  };
  exports.Parser = function Parser() {  };
  exports.Parser.prototype.parse = function parse(tokens) {
    return parser.parse(tokens);
  };
})();