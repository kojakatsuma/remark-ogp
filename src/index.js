const visit = require('unist-util-visit')
const axios = require('axios')
const { parse } = require('node-html-parser')
const path = require('path')
const { Buffer } = require('buffer')
const Iconv = require('iconv').Iconv
const jschardet = require('jschardet')

const iconv = new Iconv('SHIFT_JIS', 'UTF-8')

const genElement = (dataUrl, title, url) => {
  const base = {
    type: 'element',
    tagName: 'div',
    data: {
      hProperties: {
        style: `
                padding: 10px;
                width: 350px;
                border: 1px solid;
                border-radius: 10px;
                border-color: #3333331f;
                `,
      },
    },
    children: [],
  }
  const link = {
    type: 'link',
    url,
    title,
    data: {
      hProperties: {
        style: `
              font-size: 1em; 
              text-decoration: none;
              width: 300px;
              `,
      },
    },
  }
  link.children = [
    {
      type: 'element',
      tagName: 'div',
      children: [{ type: 'text', value: title }],
      data: {
        hProperties: {
          style: `
                font-size: 1em; 
                width: 300px;
                margin: auto;
                `,
        },
      },
    },
    {
      type: 'element',
      tagName: 'div',
      data: {
        hProperties: {
          style: `
                height: 200px;
                background-image: url(${dataUrl}); 
                background-size: contain;
                background-repeat: no-repeat;
                margin: auto;
                `,
        },
      },
    },
  ]
  base.children.push(link)
  return base
}

module.exports = () => async (tree) => {
  const parents = []
  visit(tree, 'listItem', (listItem) => {
    visit(listItem, 'link', (link) => {
      link['skip'] = true
    })
  })
  visit(tree, 'paragraph', (parent) => {
    visit(parent, 'link', (node) => {
      if (
        !node.url.includes('http') ||
        parent.children.length > 1 ||
        node.skip
      ) {
        return
      }
      parent['url'] = node.url
      parents.push(parent)
      return
    })
  })

  for (const parent of parents) {
    const { url } = parent
    const [dataUrl, title] = await getOgp(url)
    if (!dataUrl || !title) {
      continue
    }
    const content = genElement(dataUrl, title, url)
    delete parent.url
    parent.children = [content]
    parent.data = {
      hProperties: {
        style: `
            font-size: 1em; 
            text-decoration: none;
            width: 300px;
            `,
      },
    }
  }
}

const getOgp = async (url) => {
  try {
    const data = await axios
      .get(url, { responseType: 'arraybuffer' })
      .then(({ data }) => {
        const buf = Buffer.from(data)
        const { encoding } = jschardet.detect(buf)
        if (encoding === 'UTF-8') {
          return buf.toString()
        }
        if (encoding === 'SHIFT_JIS') {
          return iconv.convert(buf).toString()
        }
        throw new Error('not support Character code')
      })
    const root = parse(data)
    const metas = root.querySelectorAll('meta')
    let [image, title] = ['', '']
    metas.forEach((meta) => {
      if (meta.getAttribute('property') === 'og:image') {
        image = meta.getAttribute('content')
      }
      if (meta.getAttribute('property') === 'og:title') {
        title = meta.getAttribute('content')
      }
    })
    if (!image || !title) {
      return ['', '']
    }

    const { data: imageBuffer } = await axios
      .get(image, {
        responseType: 'arraybuffer',
      })
      .catch((error) => {
        console.log(`image download failed: ${image}`)
        throw error;
      })
    const ext = [...path.extname(image)].slice(1).join('')

    return [`data:image/${ext};base64,${imageBuffer.toString('base64')}`, title]
  } catch (error) {
    console.log(error)
    return ['', '']
  }
}
