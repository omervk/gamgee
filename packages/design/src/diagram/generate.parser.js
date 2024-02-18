const cli = require('jison/lib/cli')

// This is a workaround for https://github.com/zaach/jison/pull/352 having never been merged
const oldProcessGrammars = cli.processGrammars

cli.processGrammars = function () {
    const grammar = oldProcessGrammars.apply(this, arguments)
    grammar.options = grammar.options ?? {}
    grammar.options['token-stack'] = true
    return grammar
}

cli.main({
    file: 'src/diagram/stateDiagram.jison',
    outfile: 'src/diagram/parser.js',
    moduleType: 'commonjs',
    'token-stack': true,
})
