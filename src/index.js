const visit = require('unist-util-visit')
const axios = require('axios')
const { parse } = require('node-html-parser')
const path = require('path')


const genElement = (dataUrl, title) => {

    const root = {
        type: 'element',
        tagName: 'div',
        data: {
            hProperties: {
                className: 'MuiCardHeader-root',
                style: 'width: 100%;'
            }
        },
        children: []
    }
    const content = {
        type: 'element',
        tagName: 'div',
        data: {
            hProperties: {
                className: 'MuiCardHeader-content',
            }
        },
        children: []
    }

    const body = {
        type: 'paragraph',
        data: {
            hProperties: {
                className: ['MuiTypography-root', 'MuiTypography-body2']
            }
        },
        children: [{ type: 'text', value: title }]
    }

    const image = {
        type: 'element',
        tagName: 'div',
        data: {
            hProperties: {
                className: ['MuiCardMedia-root', 'jss82'],
                style: `background-image: url(${dataUrl});`
            }
        },
    }
    content.children.push(body)
    root.children.push(content)
    return [root, image]
}


module.exports = () => async (tree) => {
    let nodes = []
    visit(tree, "link", (node) => {
        if (!node.url.includes('http')) {
            return;
        }
        nodes.push(node)
        return;
    })
    for (const node of nodes) {
        const { url } = node
        const [dataUrl, title] = await getOgp(url)
        if (!dataUrl || !title) {
            continue;
        }
        const image = genElement(dataUrl, title)
        node['data'] = { hProperties: { className: ["MuiTypography-root", "MuiLink-root", "MuiLink-underlineNone", "MuiTypography-colorPrimary"] } }
        node.children = [...image]
    }
    return;
}

const getOgp = async (url) => {
    const { data } = await axios.get(url, { responseType: 'document' })
    const root = parse(data)
    const metas = root.querySelectorAll("meta")
    let [image, title] = ['', '']
    metas.forEach(meta => {
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

    const { data: imageBuffer } = await axios.get(image, { responseType: 'arraybuffer' })
    const ext = [...path.extname(image)].slice(1).join('')

    return [`data:image/${ext};base64,${imageBuffer.toString('base64')}`, title]

}