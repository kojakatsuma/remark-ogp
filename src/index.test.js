const remark = require('remark')
const fs = require('fs')
const ogp = require('./index')
const html = require('remark-html')
const markdown = require('remark-parse')


const doc = fs.readFileSync(`${__dirname}/example.md`)


remark().use(markdown).use(ogp).use(html).process(doc, (_err, file) => {
    console.log(file.contents)
    fs.writeFileSync('./test.html', file.contents)
})