const API_URL = 'https://hacker-news.firebaseio.com/v0/'

const state = {}

const get = async (url) => {
    let responce = await fetch(API_URL+url+'.json')
    return await responce.json();
}
const getItem = async (id) => { return await get('item/'+id)}
const getItems = async (ids) => {
    return await Promise.all(ids.map((id) => getItem(id)))
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

    if(item.type === 'job') {
        span.innerHTML = `${getDateSincePost(item.time)}`
    }

    if(item.type === 'poll' && state.hasId) {
        let parts = await (await getItems(item.parts)).sort((a,b)=> {
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
        let innerComments = await getItems(comment.kids)
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

const updateActiveLink = () => {
    let page = getParameterByName('page');
    if(page === '' || page === null) 
        page = 'main';
    [...document.getElementsByTagName('a')].map(a => a.classList.remove('link-active'))
    document.getElementById(page+'Link').classList.add('link-active')
}

const main = async () => {
    state.topStoriesIds = await get('topstories')
    state.newStoriesIds = await get('newstories')
    state.bestStoriesIds = await get('beststories')
    state.jobstoriesIds = await get('jobstories')

    state.id = getParameterByName('id')
    state.hasId = state.id !== null && state.id !== '' && state.id.match(/\d+/)
    let contentDiv = document.getElementById('content')
    switch (getParameterByName('page')) {
        case 'jobs':
            if(!state.hasId) {
                let items = await getItems(state.jobstoriesIds.slice(0,20));
                let divs = await Promise.all(items.map((i) => insert(i)))
                
                divs.filter(div => div !== null).map(div => contentDiv.appendChild(div))
            }
            document.getElementById("loader").style.display = "none";
            break;
        default:
            if(!state.hasId) {
                let items = await getItems(state.topStoriesIds.slice(0,20))
                let divs = await Promise.all(items.map((i) => insert(i)))
                divs.filter(div => div !== null).map(div => contentDiv.appendChild(div))
            } else {
                let item = await getItem(state.id)
                await insert(item)
                let comments = await getItems(item.kids)
                
                let divs = await Promise.all(comments.map((i) => insertComment(i)))
                divs.filter(c => c !== null).forEach(div => document.getElementById('content').appendChild(div))
            }
            document.getElementById("loader").style.display = "none";
            break;
    }
    // document.getElementById("loader").style.display = "none";    
}
updateActiveLink()
main()