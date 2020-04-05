const visit = require('unist-util-visit')
const axios = require('axios')
const { parse } = require('node-html-parser')
const path = require('path')


const genElement = (dataUrl, title) => {
    return [
        {
            type: 'text', value: title
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
                ` }
            }
        },
    ]
}


module.exports = () => async (tree) => {
    const nodes = []
    visit(tree, "paragraph", (parent) => {
        visit(parent, "link", (node) => {
            if (!node.url.includes('http') || !node.title) {
                return;
            }
            parent['type'] = 'link'
            parent['url'] = node.url
            nodes.push(parent)
            return;
        })
    })

    for (const node of nodes) {
        const { url } = node
        const [dataUrl, title] = await getOgp(url)
        if (!dataUrl || !title) {
            continue;
        }
        const content = genElement(dataUrl, title)
        node.title = title
        node.children = content
        node.data = {
            hProperties: {
                style: `
            font-size: 1em; 
            ` }
        }
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