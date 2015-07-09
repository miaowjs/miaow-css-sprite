var assert = require('assert');
var fs = require('fs');
var miaow = require('miaow');
var path = require('path');

var parse = require('../index');
describe('miaow-css-sprite', function () {
  this.timeout(10e3);

  var log;

  before(function (done) {
    miaow.compile({
      cwd: path.resolve(__dirname, './fixtures'),
      output: path.resolve(__dirname, './output'),
      pack: false,
      module: {
        tasks: [
          {
            test: /\.css/,
            plugins: [parse]
          }
        ]
      }
    }, function (err) {
      if (err) {
        console.error(err.toString());
        process.exit(1);
      }
      log = JSON.parse(fs.readFileSync(path.resolve(__dirname, './output/miaow.log.json')));
      done();
    });
  });

  it('接口是否存在', function () {
    assert(!!parse);
  });

  it('可以应对不需要雪碧图的样式', function () {
    assert.equal(log.modules['bar.css'].hash, 'c55463805735e6c1c8587c524305103e');
  });

  it('是否生成雪碧图', function () {
    assert.equal(log.modules['foo-sprite.png'].hash, '567e004eacd0399cade415582a933fb0');
  });
});
