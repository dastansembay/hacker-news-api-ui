const API_URL = 'https://hacker-news.firebaseio.com/v0/'

const state = {}


const get = async (url) => {
    let responce = await fetch(API_URL+url+'.json')
    return await responce.json();
}
const getItem = async (id) => { return await get('item/'+id)}
const getItems = async (ids) => await Promise.all(ids.map(id => getItem(id)))

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

const insert = (item) => {
    let div = dce('div')
    let span = dce('span')
    span.innerHTML = `${item.score} points; by ${item.by}; ${getDateSincePost(item.time)};  <a href='?id=${item.id}'>${item.descendants} comments</a>`
    let header = dce('h3')
    let a = dce('a')
    a.href = item.url
    a.textContent = item.title
    header.appendChild(a)
    div.appendChild(header)
    div.appendChild(span)
    document.getElementById('content').appendChild(div)
}


const createComment = (comment) => {
    if(comment.deleted)
        return null

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
        innerComments.map(async (c) => {
            let innerCommentDiv = await createComment(c)
            insertInner(c, innerCommentDiv)
            div.appendChild(innerCommentDiv)
        })
    }
}


const insertComment = async (comment) => {
    let commentDiv = createComment(comment)
    if(commentDiv === null)
        return
    await insertInner(comment, commentDiv)

    document.getElementById('content').appendChild(commentDiv)
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

const main = async () => {
    state.topStoriesIds = await get('topstories')
    state.newStoriesIds = await get('newstories')
    state.bestStoriesIds = await get('beststories')

    switch (window.location.pathname) {
        case '/':
            let id = getParameterByName('id')
            if(id === null || id === '' || !id.match(/\d+/)) {
                getItems(state.topStoriesIds.slice(0,20)).then((data) => data.map(insert))
            } else {
                let item = await getItem(id)
                insert(item)
                let kids = await getItems(item.kids)
                kids.map(async (i) => await insertComment(i))
            }

            break;
        case '/item.html':
                
            id = parseInt(id)
            break;
        default:
            break;
    }
    
}

main()