var book = {};
var session = {"mode":"chapter","hide":false};
var meta = {};

document.addEventListener('alpine:init', async () => {
    Draftsman.disable_cache_for_page();
    book = Alpine.reactive(book);
    session = Alpine.reactive(session);
    meta = Alpine.reactive(meta);
    Alpine.data('session', () => ({
        session: session,
        book: book,
        meta: meta
    }));
});

window.sleep = function(ms) {
    console.trace(`Sleep ${ms} milliseconds`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

window.deduplicate = function(elements){
    let array = [];
    let check = [];
    elements.forEach(x =>{
        let hash = btoa(JSON.stringify(x,true));
        if (!(check.includes(hash))){
            array.push(x);
            check.push(hash);
        }
    });
    return array;
}

window.make_sure_is_list = function(elements,deduplicate=true){
    if (Array.isArray(elements)){
        let array = [];
        let check = [];
        if (deduplicate){
            elements.forEach(x =>{
                let hash = btoa(JSON.stringify(x,true));
                if (!(check.includes(hash))){
                    array.push(x);
                    check.push(hash);
                }
            });
        } else {
            array = elements;
        }
        return array;
    } else if (elements){
        return [elements];
    } else {
        return [];
    }
}