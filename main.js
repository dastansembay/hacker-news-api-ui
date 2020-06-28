const API_URL = 'https://hacker-news.firebaseio.com/v0/'

const state = {
    offset : 0,
    fetch : 20,
    checkUpdates : true
}

const get = async (url) => {
    let responce = await fetch(API_URL+url+'.json')
    return await responce.json();
}
const getItem = (id) => { return get('item/'+id)}
const getItems = (ids) => {
    return ids.map((id) => getItem(id))
}

function fetchTopStories() {
    const topStoriesUrl = `${hnBaseUrl}/topstories.json`
    return fetch(topStoriesUrl).then(response => response.json())
      .then((data) => fetchStories(data))
  }

function fetchStories(data) {
    const topStories = data.slice(0, 29)
    const storyIds = topStories.map((storyId) => {
      const storyUrl = `${hnBaseUrl}/item/${storyId}.json`
      return fetch(storyUrl).then((response) => response.json())
        .then((story) => story)
    })
    return Promise.all(storyIds).then((stories) => {
      state.stories = stories
      renderStories(stories)
    })
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

const insert = async (item) => {
    if(item.deleted) {
        return null
    }
    let div = dce('div')
    div.classList.add('item')
    let span = dce('span')
    span.innerHTML = `${item.score} points; by ${item.by}; ${getDateSincePost(item.time)};  <a href='?id=${item.id}'>${item.descendants} comments</a>`
    let header = dce('h3')
    
    let a = dce('a')
    if(item.type === 'story' || item.type === 'job') {
        a.href = item.url
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


const createComment = (comment) => {
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

const insertInner = async (comment, div) => {
    if(comment.kids !== undefined && comment.kids.length > 0) {
        let innerComments = await Promise.all(getItems(comment.kids))
        let innerCommentDivs = await Promise.all(innerComments.map(async (c) => {
            if(c.deleted)
               return null
            let innerCommentDiv = createComment(c)
            await insertInner(c, innerCommentDiv)
            return innerCommentDiv
        }))
        innerCommentDivs.filter(c => c !== null).forEach(c => div.appendChild(c))
    }
}


const insertComment = async (comment) => {
    if(comment.deleted)
        return null
    let commentDiv = createComment(comment)
    await insertInner(comment, commentDiv)
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
    setTimeout(async () => {
        if(!state.checkUpdates) {
            createLiveDataTimeout();
            return;
        }
        console.log('checking updates')
        let ids = await get('topstories')
        if(!sameArray(ids, state.topStoriesIds)) {
            console.log('top updated')
            showSnackbar()
        } else {
            createLiveDataTimeout()
            console.log('no updates detected')
        }
    }, 5000)
}

const setLiveDataUpdater = () => {
    let snack = document.getElementById("snackbar")
    let link = document.getElementById('updatePageLink')
    link.addEventListener('click', async (e) => {
        snack.className = snack.className.replace("show", "")
        state.offset = 0
        updatePageControlsState();
        state.topStoriesIds = await get('topstories')
        await loadPage();
        createLiveDataTimeout()
        e.preventDefault();
    });

    switch (getParameterByName('page')) {
        case 'jobs':
                setInterval(async () => {
                    if(!state.checkUpdates)
                        return;
                    console.log('checking updates')
                    let ids = await get('jobstories')
                    if(!sameArray(ids, state.jobstoriesIds)) {
                        console.log('jobs updated')
                        showSnackbar()
                    } else {
                        console.log('no updates detected')
                    }
                }, 5000)
            break;
        default:
            if(!state.hasId) {
                createLiveDataTimeout();
            }
            break;
    }
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
    },false)
    
    next.addEventListener('click', async () => {
        if(state.offset+state.fetch >= state.pageTotalItems) {
            return
        }
        state.offset += state.fetch
        await loadPage()
        updatePageControlsState()
    }, false)
}

const updateActiveLink = () => {
    let page = getParameterByName('page');
    if(page === '' || page === null) 
        page = 'main';
    [...document.getElementsByTagName('a')].map(a => a.classList.remove('link-active'))
    document.getElementById(page+'Link').classList.add('link-active')
}

const loadPage = async () => {
    state.checkUpdates = false
    document.getElementById("pageControls").hidden = true;
    document.getElementById("loader").hidden = false;
    let contentDiv = document.getElementById('content')
    contentDiv.innerHTML = ""
    switch (getParameterByName('page')) {
        case 'jobs':
            if(!state.hasId) {
                state.pageTotalItems = state.jobstoriesIds.length
                let items = await Promise.all(getItems(state.jobstoriesIds.slice(state.offset, state.offset+state.fetch)));
                let divs = await Promise.all(items.map((i) => insert(i)))
                divs.filter(div => div !== null).map(div => contentDiv.appendChild(div))
                document.getElementById("pageControls").hidden = false;
            }
            document.getElementById("loader").hidden = true;
            break;
        default:
            if(!state.hasId) {
                state.pageTotalItems = state.topStoriesIds.length
                let items = await Promise.all(getItems(state.topStoriesIds.slice(state.offset, state.offset+state.fetch)))
                let divs = await Promise.all(items.map((i) => insert(i)))
                divs.filter(div => div !== null).map(div => contentDiv.appendChild(div))
                document.getElementById("pageControls").hidden = false;
            } else {
                let item = await getItem(state.id)
                let div = await insert(item)
                document.getElementById('content').appendChild(div)
                let comments = await Promise.all(getItems(item.kids))
                
                let divs = await Promise.all(comments.map((i) => insertComment(i)))
                divs.filter(c => c !== null).forEach(div => document.getElementById('content').appendChild(div))
            }
            
            document.getElementById("loader").hidden = true;
            break;
    }
    state.checkUpdates = true;
}


const main = async () => {
    state.topStoriesIds = await get('topstories')
    state.jobstoriesIds = await get('jobstories')
    state.newStoriesIds = await get('newstories')
    state.bestStoriesIds = await get('beststories')
    
    state.id = getParameterByName('id')
    state.hasId = state.id !== null && state.id !== '' && state.id.match(/\d+/)
    await loadPage()
    setLiveDataUpdater()
}
updateActiveLink()
bindPageControls()
main()
