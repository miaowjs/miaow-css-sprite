# miaow-css-sprite

> Miaow的CSS自动雪碧图工具

```css
.bar {
  display: inline-block;
  background: url(./bar.png#sprite) no-repeat left top;
  width: 153px;
  height: 74px;
}

.baz {
  position: absolute;
  top: 0;
  left: 0;
  background-image: url(./baz.jpg#sprite);
  width: 237px;
  height: 112px;
}

/* 处理后 */
.bar {
  display: inline-block;
  background: url(./bar.png#sprite) no-repeat left top;
  width: 153px;
  height: 74px;
  /* 以下内容由 miaow-css-sprite 生成 */
  background-image: url(foo-sprite_567e004eac.png);
  background-position: 0 0;
}

.baz {
  position: absolute;
  top: 0;
  left: 0;
  background-image: url(./baz.jpg#sprite);
  width: 237px;
  height: 112px;
  /* 以下内容由 miaow-css-sprite 生成 */
  background-image: url(foo-sprite_567e004eac.png);
  background-position: 0 -84px;
}
```

## 使用说明

### 安装

```
npm install miaow-css-sprite --save-dev
```

### 在项目的 miaow.config.js 中添加模块的 tasks 设置

```javascript
//miaow.config.js
module: {
  tasks: [
    {
      test: /\.css$/,
      plugins: ['miaow-css-sprite']
    }
  ]
}
```
