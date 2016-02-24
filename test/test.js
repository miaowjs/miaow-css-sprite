var _ = require('lodash');
var assert = require('assert');
var fs = require('fs');
var miaow = require('miaow');
var path = require('path');

var parse = require('../index');
describe('miaow-css-sprite', function() {
  this.timeout(10e3);

  var log;

  before(function(done) {
    miaow({
      context: path.resolve(__dirname, './fixtures')
    }, function(err) {
      if (err) {
        console.error(err.toString(), err.stack);
        process.exit(1);
      }

      log = JSON.parse(fs.readFileSync(path.resolve(__dirname, './output/miaow.log.json')));
      done();
    });
  });

  it('接口是否存在', function() {
    assert(!!parse);
  });

  it('可以应对不需要雪碧图的样式', function() {
    assert.equal(_.find(log.modules, {src: 'bar.css'}).destHash, 'a8d89002f2239aa15e26cb50d0038fc3');
  });

  it('是否生成雪碧图', function() {
    assert.equal(_.find(log.modules, {src: 'foo.css.sprite.png'}).destHash, 'abe24181c3881a749c269c77f1ed5cf6');
  });
});
