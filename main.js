const API_URL = 'https://hacker-news.firebaseio.com/v0/'

const state = {
    offset : 0,
    fetch : 20,
    checkUpdates : true,
    top: {

    },
    new: {

    },
    best: {

    },
    ask: {

    },
    show: {

    },
    job: {

    },
}

const get = async (url) => {
    let responce = await fetch(API_URL+url+'.json')
    return await responce.json();
}
const getItem = (id) => { return get('item/'+id)}
const getItems = (ids) => {
    if(ids === undefined)
        return [];
    return ids.map((id) => getItem(id))
}

function getDateSincePost(postDate) {
    var timeSince = (Date.now() / 1000) - postDate;
    var days = Math.floor(timeSince / (60 * 60 * 24));
 
    if (days)
       return days + " days ago";
 
    var hours = Math.floor(timeSince / (60 * 60));
 
    if (hours)
       return hours + " hours ago";
 
    var minutes = Math.floor(timeSince / 60);
 
    return minutes + " minutes ago";
 }

let dce = (tag) => document.createElement(tag)

const createItemDiv = async (item) => {
    let div = dce('div')
    div.classList.add('item')
    let span = dce('span')
    span.innerHTML = `${item.score} points; by ${item.by}; ${getDateSincePost(item.time)};  <a href='?id=${item.id}'>${item.descendants} comments</a>`
    let header = dce('h3')
    
    let a = dce('a')
    if(item.type === 'story' || item.type === 'job') {
        a.href = item.url ? item.url : `?id=${item.id}`
    } else {
        a.href = window.location.href
    }
    a.textContent = item.title

    header.appendChild(a)
    div.appendChild(header)
    div.appendChild(span)

    if(item.text && state.hasId) {
        div.appendChild(dce('br'))
        div.innerHTML += item.text
    }

    if(item.type === 'job') {
        span.innerHTML = `${getDateSincePost(item.time)}`
    }

    if(item.type === 'poll' && state.hasId) {
        let parts = (await Promise.all(getItems(item.parts))).sort((a,b)=> {
            let scoreA = a.score
            let scoreB = b.score
            if(scoreA == scoreB) return 0
            return scoreA > scoreB ? -1 : 1
        })
        parts.map((p) => {
            let pdiv = dce('div')
            pdiv.classList.add('poll')
            let pheader = dce('span')
            pheader.classList.add('poll-option')
            pheader.textContent = p.text
            let pspan = dce('span')
            pspan.style.marginLeft = '5px'
            pspan.innerHTML = `<small style='color:gray'>  ${p.score} points</small>`
            pdiv.appendChild(pheader)
            pdiv.appendChild(pspan)
            div.appendChild(pdiv)
        })
    }

    return div
}


const generateCommentDiv = (comment) => {
    let div = dce('div')
    div.classList.add('comment')

    let header = dce('span')
    header.innerHTML = `<b>${comment.by}</b> <small>${getDateSincePost(comment.time)}</small>`

    let text = dce('div')
    text.classList.add('commentText')
    text.innerHTML = comment.text

    div.appendChild(header)
    div.appendChild(text)
    return div
}

const insertInnerComments = async (comment, div) => {
    if(comment.kids !== undefined && comment.kids.length > 0) {
        let innerComments = await Promise.all(getItems(comment.kids))
        let innerCommentDivs = await Promise.all(innerComments.filter(c => !c.deleted).map(async (c) => {
            let innerCommentDiv = generateCommentDiv(c)
            await insertInnerComments(c, innerCommentDiv)
            return innerCommentDiv
        }))
        innerCommentDivs.map(c => div.appendChild(c))
    }
}

const createCommentDiv = async (comment) => {
    let commentDiv = generateCommentDiv(comment)
    await insertInnerComments(comment, commentDiv)
    return commentDiv
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

const sameArray = (arr1, arr2) => {
    if(arr1.length !== arr2.length) {
        return false          
    }

    for(let i=0; i < arr1.length; i++)
        if(arr1[i] !== arr2[i]) 
            return false;

    return true;
}

const showSnackbar = () => {
    var snack = document.getElementById("snackbar");
    snack.className = "show";
  }

const createLiveDataTimeout = () => {
    if(state.hasId) {
        return
    }
    let page = getCurrentPage()
    setTimeout(async () => {
        if(!state.checkUpdates) {
            createLiveDataTimeout();
            return;
        }
        console.log(page+': checking updates')
        let ids = await get(page+'stories')
        if(!sameArray(ids, state[page].ids)) {
            console.log(page+': updates available')
            showSnackbar()
        } else {
            createLiveDataTimeout()
            console.log(page+': no updates detected')
        }
    }, 5000)
}

const setLiveDataUpdater = () => {
    let snack = document.getElementById("snackbar")
    let link = document.getElementById('updatePageLink')
    link.addEventListener('click', async (e) => {
        snack.className = snack.className.replace("show", "")
        await updatePageProps()
        await loadPage();
        createLiveDataTimeout()
        e.preventDefault();
    });
    createLiveDataTimeout();
}

const updatePageControlsState = () => {
    let prev = document.getElementById('pagePrev')
    let next = document.getElementById('pageNext')
    prev.disabled = state.offset == 0
    next.disabled = state.offset+state.fetch >= state.pageTotalItems
}

const bindPageControls = () => {
    let prev = document.getElementById('pagePrev')
    let next = document.getElementById('pageNext')
    prev.addEventListener('click', async () => {
        if(state.offset == 0) {
            return
        }
        state.offset -= state.fetch
        await loadPage();
        updatePageControlsState();
    }, false)
    
    next.addEventListener('click', async () => {
        if(state.offset+state.fetch >= state.pageTotalItems) {
            return
        }
        state.offset += state.fetch
        await loadPage()
        updatePageControlsState()
    }, false)
}

const getCurrentPage = () => {
    let p = getParameterByName('page')
    if(p === '/' || p === null) {
        return 'top'
    }
    return p
}

const updateActiveLink = () => {
    let page = getCurrentPage()
    let links = [...document.getElementsByTagName('a')].filter(l => l.href.includes('page'))
    links.map(a => a.classList.remove('link-active'))
    links.find(l => l.href.includes(`?page=${page}`)).classList.add('link-active')
}

const loadPage = async () => {
    state.checkUpdates = false
    document.getElementById("pageControls").hidden = true;
    document.getElementById("loader").hidden = false;

    let page = getCurrentPage()
    let contentDiv = document.getElementById('content')
    contentDiv.innerHTML = ""
    if(state.hasId) {
        let item = await getItem(state.id)
        let div = await createItemDiv(item)
        document.title = item.title
        document.getElementById('content').appendChild(div)
        let comments = await Promise.all(getItems(item.kids))
        
        let divs = await Promise.all(comments.filter(c => !c.deleted && !c.dead).map((c) => createCommentDiv(c)))
        divs.map(div => contentDiv.appendChild(div))
    } else {
        document.title = 'HN '+page
        let items = await Promise.all(getItems(state[page].ids.slice(state.offset, state.offset + state.fetch)))
        let divs = await Promise.all(items.filter(i => !i.deleted && !i.dead).map((i) => createItemDiv(i)))
        divs.map(div => contentDiv.appendChild(div))
        document.getElementById("pageControls").hidden = false;
    }

    document.getElementById("loader").hidden = true;
    state.checkUpdates = true
}

const updatePageProps = async () => {
    let page = getCurrentPage()
    state[page].ids = await get(page+'stories')
    state.pageTotalItems = state[page].ids.length
    state.id = getParameterByName('id')
    state.hasId = state.id !== null && state.id !== '' && state.id.match(/\d+/)
    state.offset = 0
    state.fetch = 20
    updatePageControlsState()
}

const main = async () => {
    await updatePageProps()
    await loadPage()
    setLiveDataUpdater()
}

updateActiveLink()
bindPageControls()
main()
