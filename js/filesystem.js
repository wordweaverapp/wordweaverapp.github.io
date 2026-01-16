
import { Buffer } from "https://esm.sh/buffer@6";
globalThis.Buffer = Buffer;

// soms nodig bij libs die "process" verwachten
import process from "https://esm.sh/process@0.11";
globalThis.process = process;

import http from '/js/http.js'

const dir = '/book';
const proxy = "https://git.draftsman.io";
var auto_save = null;
var sync_interval = null;
var fs = null;

var branch = "main";
var checked_out_repository = "";
var file_check = {};

function chapterSortFunction(a, b) {
  a = parseFloat(a.split(" ").at(0));
  b = parseFloat(b.split(" ").at(0));
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  }
  return 0;
}

window.Book = {
    load_chapters: function(){
        let keys = Object.keys(book);
        session.chapters = keys.map(x => x.replace("chapter ","").replace(".md","")).sort(chapterSortFunction);
    },
    add_chapter: function(){
        let name = prompt("Chapter title");
        if (name){
            let handle = `${session.chapters.length + 1} ${name}`;
            let file = `chapter ${handle}.md`;
            book[file] = {content:""};
            session.body = book[file];
            session.mode = "chapter";
            Book.load_chapters();
            session.chapter = handle;
        }
    },
    open_chapter: function(chapter){
        session.body = book[`chapter ${chapter}.md`];
        session.mode = "chapter";
        localStorage.chapter = chapter;
        session.chapter = chapter;
    },
    open_previous: function(){
        let index = session.chapters.indexOf(session.chapter) - 1;
        Book.open_chapter(session.chapters.at(index));
    },
    open_next: function(){
        let index = session.chapters.indexOf(session.chapter) + 1;
        Book.open_chapter(session.chapters.at(index));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    register_character: function(){
        meta.characters = make_sure_is_list(meta.characters);
        let screenName = prompt("Provide screenname");
        let protagonist = false;
        let color = "";
        if (meta.characters.filter(x => x.protagonist).length == 0){
            protagonist = confirm("Is this character the protagonist?");
        }
        if (!protagonist){
            color = prompt("Do you want to use a color override?");
        }
        meta.characters.push({
           screenName:screenName,
           protagonist:protagonist,
           color:color
        });
    },
    insert_chat_message: function(character,time,message){
        character = meta.characters.filter(x => x.screenName == character).at(0);
        let myField = document.getElementById("paper");
        let html = "";
        if (character.protagonist){
            html += "<chat-m>";
        } else if (character.color){
            html+= `<chat-f style="background-color:${character.color};">`;
        } else {
            html += "<chat-f>"
        }
        html += character.screenName;
        html += `<t>${time}</t>\n${message}`;
        if (character.protagonist){
            html += "</chat-m>";
        } else {
            html += "</chat-f>";
        }
        //IE support
        if (document.selection) {
            myField.focus();
            sel = document.selection.createRange();
            sel.text = html;
        }
        //MOZILLA and others
        else if (myField.selectionStart || myField.selectionStart == '0') {
            var startPos = myField.selectionStart;
            var endPos = myField.selectionEnd;
            myField.value = myField.value.substring(0, startPos)
                + html
                + myField.value.substring(endPos, myField.value.length);
        } else {
            myField.value += html;
        }
    },
    remove_chapter: async function(){
        let chapter = session.chapter;
        if (!confirm("Remove chapter " + chapter + "?")){return}
        let index = session.chapters.indexOf(chapter);
        if (index == 0){
            Book.open_next();
        } else {
            Book.open_previous();
        }
        let path = `chapter ${chapter}.md`;
        delete book[path];
        await FileSystem.delete(path);
        await Book.load_chapters();
        await Book._renumber();
    },
    rename: async function(){
        let newName = prompt("Provide new chapter title");
        if (!newName){return}
        let name = await Book._rename(session.chapter,newName);
        Book.open_chapter(name);
        Book.load_chapters();
    },
    change_chapter_position: async function(){
        let newPosition = prompt("Move chapter to position (1, 2, 3 -- n)");
        let storedPosition = newPosition;
        if (!newPosition){return};
        newPosition = parseInt(newPosition);// - 0.5;
        if (!newPosition){return};
        let oldName = `chapter ${session.chapter}.md`;
        let newName = session.chapter.split(" ");
        newName.shift();
        newName = newName.join(" ");
        let handle = `${storedPosition} ${newName}`;
        newName = `chapter ${newPosition} ${newName}.md`
        book[newName] = book[oldName];
        delete book[oldName];
        try{
            await FileSystem.delete(oldName);
        }catch{}
        await Book.load_chapters();
        Book._renumber();
        Book.open_chapter(handle);
    },
    _renumber: async function(){
        await session.chapters.forEach(async chapter => {
            let name = chapter.split(" ");
            name.shift();
            name = name.join(" ");
            await Book._rename(chapter, name);
        });
        await Book.load_chapters();
    },
    _rename: async function(oldName, newName){
        let number = session.chapters.indexOf(oldName) + 1;
        let handle = `${number} ${newName}`;
        oldName = `chapter ${oldName}.md`;
        newName = `chapter ${handle}.md`;
        if(oldName == newName){return}
        book[newName] = book[oldName];
        delete book[oldName];
        try{
            await FileSystem.delete(oldName);
        }catch{}
        return handle;
    }
}

async function open_book(){
    await Book.load_chapters();
    if (session.chapters.includes(localStorage.chapter)){
        Book.open_chapter(localStorage.chapter);
    } else if (!localStorage.chapter){
        Book.open_chapter(session.chapters.at(0));
    }
}

function convert_minutes_to_string(calculated_minutes){
    let text = "";
    let hours = Math.floor(calculated_minutes / 60);
    let minutes = Math.floor(calculated_minutes % 60);
    if (hours != 0){
        text += `${hours} hours`
    }
    if (hours != 0 && minutes != 0){
        text += " and ";
    }
    if (minutes != 0){
        text += `${minutes} minutes`
    }
    return text;
}

function analyse(){
    //https://dev.to/michaelburrows/calculate-the-estimated-reading-time-of-an-article-using-javascript-2k9l
    let word_count = 0;
    const wpm = 265;
    Object.keys(book).forEach(name => {
        let chapter = book[name];
        chapter.words = chapter.content.trim().split(/\s+/).length;
        chapter.time = convert_minutes_to_string(Math.ceil(chapter.words / wpm));
        word_count += chapter.words;
    });
    session.word_count = word_count;
    session.time = convert_minutes_to_string(Math.ceil(word_count / wpm));
}

document.addEventListener('draftsman:initialized', async () => {
    let context = Alpine.store("context").get;
    meta.title = context.title;
    localStorage.book = context.title.replaceAll(" ","");
    if (context.url && context.url != checked_out_repository){
        clearInterval(auto_save);
        clearInterval(sync_interval);
        checked_out_repository = context.url;
        try{
            await connect_repository();
        }catch(err){
            console.error(err);
        }
        await load_book();
        auto_save = setInterval(save_book_to_disk,1000);
        sync_interval = setInterval(sync_book,5*60*1000);
    }
    open_book();
    setInterval(analyse,1000);
});

window.clear_storage = async function(force=false){
    clearInterval(auto_save);
    clearInterval(sync_interval);
    var databases = await indexedDB.databases();
    for (var r of databases){
        indexedDB.deleteDatabase(r.name);
    }
    Draftsman.sign_out();
}

async function reload_book(){
    clearInterval(auto_save);
    while (save_book_to_disk_block){
        await sleep(10);
    }
    await load_book();
    auto_save = setInterval(save_book_to_disk,1000);
}

async function sync_book(){
    await pull_book();
    await reload_book();
}

var save_book_to_disk_block = false;

async function save_chapter(chapter){
    book[chapter.file] = chapter;
    await FileSystem.write(chapter.file,chapter.content);
}

async function save_book_to_disk(){
    if (save_book_to_disk_block){return}else{save_book_to_disk_block = true}
    try{
        await Object.keys(book).filter(file => file in book && "content" in book[file]).forEach(async file => {
            book[file].file = file;
            await FileSystem.write(file,book[file].content);
            let date = new Date();
            book[file].last_saved = date.getTime();
        });
        await FileSystem.write("meta.json",JSON.stringify(meta,true,2));
        let status = await get_status_matrix();
        session.staged_files = deduplicate(status.map(x => x[0]));
    }catch(err){
        console.error(err);
    }
    save_book_to_disk_block = false;
}

async function load_file(file){
    let content = await FileSystem.read(file);
    if (file.startsWith('chapter') && file.endsWith('.md')){
        book[file] = {content:content};
    }
    if (file == "meta.json"){
        let data = JSON.parse(content);
        Object.keys(data).forEach(key => {
            meta[key] = data[key];
        });
    }
}

async function load_book(){
    clear_book();
    let files = await FileSystem.listFiles();
    await files.forEach(async file => {
        await load_file(file);
    });
    let status = await get_status_matrix();
    status.forEach(async staged => {
        let state = await FileSystem.file_status(staged[0]);
        if (state != "deleted"){
            await load_file(staged[0]);
        }
    });
    await sleep(500);
    Book.load_chapters();
}

function clear_book(){
    for (var member in book) delete book[member];
}

async function connect_repository(){
    fs = new LightningFS(localStorage.book);
    if (await FileSystem.read("README.md") == "file not found"){
        console.log("clone",checked_out_repository);
        await git.clone({ fs, http, dir, url: checked_out_repository, corsProxy: proxy });

        console.log("set author");
        await git.setConfig({
          fs,
          dir: dir,
          path: 'user.name',
          value: localStorage["username"]
        })
    }
    await pull_book();
}

async function pull_book(){
    if (!await FileSystem.staged_files()){
      console.log("checkout: " + branch);
      await FileSystem.checkout_branch(branch);
      prepare_folder_structure();
      const currentDate = new Date();
      session.last_pulled = currentDate.getTime();
    }
}


window.FileSystem = {
    sync_book: sync_book,
    clean_and_pull: function(){
        indexedDB.deleteDatabase(localStorage.book);
        localStorage[localStorage.book] = JSON.stringify(session);
        setTimeout(function(){location.reload()},500);
    },
    listFiles: async function(){
        return await git.listFiles({ fs, dir: dir, ref: 'HEAD' });
    },
    staged_files: async function(){
        let status = await get_status_matrix();
        return status.length != 0;
    },
    read: async function(filepath){
        try{
            return await fs.promises.readFile(dir + "/" + filepath, "utf8");
        } catch {
            return "file not found";
        }
    },
    write: async function(filepath,content){
        if (!content || file_check[filepath] == content){
            return;
        }
        file_check[filepath] = content;
        try{
            await FileSystem.create_dir(filepath);
            await fs.promises.writeFile(dir + "/" + filepath, content,"utf8");
            await git.add({ fs, dir: dir, filepath: filepath });
        }catch(err){console.log(err)}

    },
    delete: async function(filepath){
        try{
            await git.remove({ fs, dir: dir, filepath: filepath });
            await fs.promises.unlink(dir + "/" + filepath);
        }catch{}
    },
    create_dir: async function(path){
        var subdir = dir;
        for (const sub of path.split('/')){
            if (!sub || sub.includes(".")){
                continue;
            }
            subdir += '/' + sub;
            try{
                await fs.promises.mkdir(subdir);
            } catch{}
        }
    },
    commit: async function(message){
        session.hide = true;
        clearInterval(auto_save);
        try{
            //Backup
            await Object.keys(book).filter(file => file in book && "content" in book[file]).forEach(async file => {
                localStorage["cm: " + file] = book[file].content;
            });
        }catch{}
        let username = localStorage["username"];
        let sha = await git.commit({
          fs,
          dir: dir,
          author: {
            name: username,
            email: username + '@example.com',
          },
          message: message
        });
        let pushResult = await git.push({
          fs,
          http,
          dir: dir,
          remote: 'origin',
          force: true,
          ref: branch,
          corsProxy: proxy
        })
        await FileSystem.pull();
        await reload_book();
        location.reload();
    },
    get_history: async function(){
        return await git.log({fs,dir:dir});
    },
    pull: async function(){
        await git.fetch({fs,dir: dir,http: http});
        await git.pull({fs,http,dir: dir});
    },
    checkout_branch: async function(branch){
        await git.fetch({
          fs,
          dir: dir,
          http: http
        })
        await git.checkout({
          fs,
          dir: dir,
          ref: branch
        })
        await git.pull({
          fs,
          http,
          dir: dir
        })
    },
    checkout_commit: async function(commit){
        await git.checkout({
          fs,
          dir: dir,
          ref: commit.oid
        });
        await reload_book();

        let message = "Revision [";
        let id = crc32(commit.oid);
        message += id;
        message += "] is read-only. Reload this page to return back to the last revision.";
        message += ' <button type="button" class="btn btn-outline-danger" @click="FileSystem.revert_to(';
        message += "'"+ id +"'";
        message += ')">Revert to revision '+ id +'</button>';
        message += '<br><br><button type="button" class="btn btn-outline-danger" @click="FileSystem.clean_and_pull()">Cancel</button>';
        session.exception = message;
        session.editing_disabled = true;
    },
    revert_to: async function(id){
        let file_stash = {};
        var files = await git.listFiles({ fs, dir: dir, ref: 'HEAD' })
        for (const file of files) {
            file_stash[file] = await FileSystem.read(file);
        }
        await FileSystem.checkout_branch(branch);
        await cleanup_git_directory();
        for (const [path, content] of Object.entries(file_stash)) {
          await FileSystem.write(path,content);
        }
        session.editing_disabled = false;
        delete session.exception;
        await reload_book();
    },
    file_status: async function(path){
        let status = await git.status({ fs, dir: dir, filepath: path });
        return status;
    },
    remove_from_staging: async function(path,noreload=false){
        clearInterval(auto_save);
        let file_status = await FileSystem.file_status(path);
        await git.resetIndex({ fs, dir: dir, filepath: path });
        await git.checkout({
          fs,
          dir: dir,
          ref: branch,
          force: true,
          filepaths: [path]
        });
        if (!noreload && file_status != "added"){
            await load_file(path);
        }
        if (!noreload && file_status == "added"){
            await FileSystem.delete(path);
            delete book[path];
        }
        let status = await get_status_matrix();
        session.staged_files = deduplicate(status.map(x => x[0]));
        clearInterval(auto_save);
        auto_save = setInterval(save_book_to_disk,1000);
        setTimeout(Book.load_chapters,100);
    }
}


async function prepare_folder_structure(){
    await ["/images",].forEach(async path => {
        try{await fs.promises.mkdir(dir + path);} catch{}
    });
}

var makeCRCTable = function(){
    var c;
    var crcTable = [];
    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
}

window.crc32 = function(str) {
    var crcTable = window.crcTable || (window.crcTable = makeCRCTable());
    var crc = 0 ^ (-1);

    for (var i = 0; i < str.length; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
};

async function cleanup_git_directory(){
        var files = await git.listFiles({ fs, dir: dir, ref: 'HEAD' })
        for (const file of files) {
            await git.remove({ fs, dir: dir, filepath: file });
            await fs.promises.unlink(dir + "/" + file);
        }
        await prepare_folder_structure();
    }

async function get_status_matrix(){
        let status = await git.statusMatrix({fs,dir: dir});
        return status.filter(x => !(x[1] == 1 && x[3] == 1));
    }