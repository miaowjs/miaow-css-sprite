var _ = require('lodash');
var async = require('async');
var gm = require('gm');
var path = require('path');
var postcss = require('postcss');

var pkg = require('./package.json');

function getBackgroundImageAndNodeList(root, options, callback) {
  var backgroundImageList = [];

  var keyword = _.isUndefined(options.keyword) ? 'sprite' : options.keyword;
  var reg = new RegExp('url\\s*\\(\\s*[\'"]?([\\w\\_\\/\\.\\-]+)' +
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
      async.series([
        function(callback) {
          context.resolveModule(backgroundImage.src, function(err, backgroundModule) {
            if (err) {
              return callback(err);
            }

            context.addFileDependency(backgroundModule.src);

            backgroundImage.src = path.resolve(context.context, backgroundModule.src);
            callback();
          });
        },

        function(callback) {
          gm(backgroundImage.src)
            .identify(function(err, data) {
              if (err) {
                return callback(err);
              }

              backgroundImage.width = data.size.width;
              backgroundImage.height = data.size.height;
              backgroundImage.format = data.format;

              callback();
            });
        }
      ], callback);
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

  var image = gm(width, height, 'none');

  var top = 0;

  // 绘制图片
  _.each(backgroundImageList, function(backgroundImage) {
    var left = 0;

    image.draw('image', 'Over', [left, top].join(','), '0,0', backgroundImage.src);

    backgroundImage.offset = {
      left: left,
      top: top
    };

    top += backgroundImage.height + margin;
  });

  // 生成文件
  image.toBuffer('PNG', function(err, buffer) {
    if (err) {
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
  });
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
