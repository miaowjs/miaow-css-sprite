var _ = require('lodash');
var async = require('async');
var images = require('images');
var path = require('path');
var postcss = require('postcss');

var pkg = require('./package.json');

function getBackgroundImageAndNodeList(root, options, callback) {
  var backgroundImageList = [];

  var keyword = _.isUndefined(options.keyword) ? 'sprite' : options.keyword;
  var reg = new RegExp('url\\s*\\(\\s*[\'"]?([^\/][\\w\\_\\/\\.\\-]*)' +
    (keyword ? ('\\#' + keyword) : '') +
    '[\'\"]?\\s*\\)', 'im');

  var context = this;

  var backgroundNodeList = _.filter(root.nodes, function(node) {
    if (node.type === 'rule') {
      return _.findLast(node.nodes, function(subNode) {
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
    }
  });

  if (backgroundImageList.length === 0) {
    return callback('No need sprite');
  }

  async.eachSeries(
    backgroundImageList,
    function(backgroundImage, callback) {
      context.resolveModule(backgroundImage.src, function(err, module) {
        if (err) {
          return callback(err);
        }

        backgroundImage.src = path.resolve(module.context, module.src);

        var image;
        var size;

        try {
          image = images(backgroundImage.src);
          size = image.size();
        } catch(err) {
          return callback(err);
        }

        backgroundImage.image = image;
        backgroundImage.width = size.width;
        backgroundImage.height = size.height;

        callback();
      });
    },

    function(err) {
      callback(err, options, backgroundImageList, backgroundNodeList);
    });
}

function createSpriteImage(options, backgroundImageList, backgroundNodeList, callback) {
  var context = this;
  var width;
  var height;
  var margin = _.isUndefined(options.margin) ? 10 : options.margin;

  width = _.max(backgroundImageList, function(backgroundImage) {
    return backgroundImage.width;
  }).width;

  height = _.reduce(backgroundImageList, function(total, backgroundImage) {
    return total + backgroundImage.height;
  }, 0);

  height += margin * (backgroundImageList.length - 1);

  var image = images(width, height);

  var top = 0;

  // 绘制图片
  _.each(backgroundImageList, function(backgroundImage) {
    var left = 0;

    image.draw(backgroundImage.image, left, top);

    backgroundImage.offset = {
      left: left,
      top: top
    };

    top += backgroundImage.height + margin;
  });

  // 生成文件
  var buffer;

  try {
    buffer = image.encode('PNG');
  } catch(err) {
    return callback(err);
  }

  // 创建模块并编译
  context.emitModule(
    context.src + '.sprite.png',
    buffer,
    function(err, spriteModule) {
      callback(err, backgroundImageList, backgroundNodeList, spriteModule);
    }
  );
}

function addSpriteImageProp(backgroundImageList, backgroundNodeList, spriteModule, callback) {
  _.each(backgroundNodeList, function(backgroundNode, i) {
    // 添加注释
    backgroundNode.append({
      text: '以下内容由 ' + pkg.name + ' 生成'
    });

    // 添加背景图链接
    backgroundNode.append({
      prop: 'background-image',
      value: 'url(' + spriteModule.url + ')'
    });

    // 添加背景图位置
    var offset = backgroundImageList[i].offset;
    backgroundNode.append({
      prop: 'background-position',
      value: [(-offset.left) + (offset.left ? 'px' : ''),
        (-offset.top) + (offset.top ? 'px' : '')].join(' ')
    });
  });

  callback();
}

module.exports = function(options, callback) {
  var context = this;
  var contents = context.contents.toString();

  if (!contents.trim()) {
    return callback();
  }

  var root = postcss.parse(contents, {from: path.resolve(context.context, context.src)});

  async.waterfall([
    getBackgroundImageAndNodeList.bind(context, root, options),
    createSpriteImage.bind(context),
    addSpriteImageProp.bind(context)
  ], function(err) {
    if (err && err !== 'No need sprite') {
      return callback(err);
    }

    try {
      context.contents = new Buffer(root.toResult().css);
    } catch (err) {
      return callback(err);
    }

    callback();
  });
};

module.exports.toString = function() {
  return [pkg.name, pkg.version].join('@');
};
