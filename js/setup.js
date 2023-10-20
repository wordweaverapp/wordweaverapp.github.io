var book = {};
var session = {"mode":"chapter"};
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