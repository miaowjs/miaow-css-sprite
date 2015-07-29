var _ = require('lodash');
var async = require('async');
var gm = require('gm');
var mutil = require('miaow-util');
var path = require('path');
var postcss = require('postcss');

var pkg = require('./package.json');

function getBackgroundImageAndNodeList(root, option, cb) {
  var backgroundImageList = [];

  var keyword = _.isUndefined(option.keyword) ? 'sprite' : option.keyword;
  var reg = new RegExp('url\\s*\\(\\s*[\'"]?([\\w\\_\\/\\.\\-]+)' +
    (keyword ? ('\\#' + keyword) : '') +
    '[\'\"]?\\s*\\)', 'im');

  var module = this;

  var backgroundNodeList = _.filter(root.nodes, function (node) {
    if (node.type !== 'rule') {
      return;
    }

    return _.findLast(node.nodes, function (subNode) {
      if (
        subNode.type === 'decl' &&
        (subNode.prop === 'background' || subNode.prop === 'background-image') &&
        reg.test(subNode.value)
      ) {
        backgroundImageList.push({
          src: reg.exec(subNode.value)[1]
        });
        return true;
      }
    });
  });

  if (backgroundImageList.length === 0) {
    return cb('No need sprite');
  }

  async.eachSeries(backgroundImageList, function (backgroundImage, cb) {
    async.series([
      function (cb) {
        module.getModule(backgroundImage.src, function (err, backgroundModule) {
          if (err) {
            return cb(err);
          }

          backgroundImage.src = backgroundModule.srcAbsPath;
          cb();
        });
      },
      function (cb) {
        gm(backgroundImage.src)
          .identify(function (err, data) {
            if (err) {
              return cb(err);
            }

            backgroundImage.width = data.size.width;
            backgroundImage.height = data.size.height;
            backgroundImage.format = data.format;

            cb();
          });
      }
    ], cb);
  }, function (err) {
    cb(err, option, backgroundImageList, backgroundNodeList);
  });
}

function createSpriteImage(option, backgroundImageList, backgroundNodeList, cb) {
  var width;
  var height;
  var margin = _.isUndefined(option.margin) ? 10 : option.margin;

  width = _.max(backgroundImageList, function (backgroundImage) {
    return backgroundImage.width;
  }).width;

  height = _.reduce(backgroundImageList, function (total, backgroundImage) {
      return total + backgroundImage.height;
    }, 0) + (margin * (backgroundImageList.length - 1));

  var image = gm(width, height, 'none');

  var top = 0;

  //绘制图片
  _.each(backgroundImageList, function (backgroundImage) {
    var left = 0;

    image.draw('image', 'Over', [left, top].join(','), '0,0', backgroundImage.src);

    backgroundImage.offset = {
      left: left,
      top: top
    };

    top += backgroundImage.height + margin;
  });

  var imagePath = path.join(
    path.dirname(this.srcAbsPath),
    path.basename(this.srcPath, path.extname(this.srcPath)) + '-sprite.png'
  );

  //生成文件
  image.toBuffer('PNG', function (err, buffer) {
    if (err) {
      return cb(err);
    }

    //创建模块并编译
    this.createModule(
      imagePath,
      buffer,
      function (err, spriteModule) {
        cb(err, backgroundImageList, backgroundNodeList, spriteModule);
      }
    );
  }.bind(this));
}

function addSpriteImageProp(backgroundImageList, backgroundNodeList, spriteModule, cb) {
  _.each(backgroundNodeList, function (backgroundNode, i) {
    //添加注释
    backgroundNode.append({
      text: '以下内容由 ' + pkg.name + ' 生成'
    });

    //添加背景图链接
    var url = spriteModule.url ||
      mutil.relative(path.dirname(this.destAbsPath), spriteModule.destAbsPathWithHash);

    backgroundNode.append({
      prop: 'background-image',
      value: 'url(' + url + ')'
    });

    //添加背景图位置
    var offset = backgroundImageList[i].offset;
    backgroundNode.append({
      prop: 'background-position',
      value: [(-offset.left) + (offset.left ? 'px' : ''),
        (-offset.top) + (offset.top ? 'px' : '')].join(' ')
    });
  }.bind(this));

  cb();
}

function sprite(option, cb) {
  var root = postcss.parse(this.contents, {from: this.srcAbsPath});

  async.waterfall([
    getBackgroundImageAndNodeList.bind(this, root, option),
    createSpriteImage.bind(this),
    addSpriteImageProp.bind(this)
  ], function (err) {
    if (err && err !== 'No need sprite') {
      return cb(new mutil.PluginError(pkg.name, err, {
        fileName: this.srcAbsPath,
        showStack: true
      }));
    }

    this.contents = new Buffer(root.toResult().css);
    cb();
  }.bind(this));
}

module.exports = mutil.plugin(pkg.name, pkg.version, sprite);
