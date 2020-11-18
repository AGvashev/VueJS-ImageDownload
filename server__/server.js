// содежимое index.js
const app = require('express')()
const http = require('http');
const url = require('url');
const { parse } = require('querystring');
const port = 3000;
const fs = require('fs-extra')
const path = require('path');
const axios = require('axios');
const uniqid = require('uniqid');
const cheerio = require('cheerio');
const { dirname } = require('path');
const puppeteer = require('puppeteer');
const imageUrls = [];


// Функция для реализации загрузки картинок 
const download_image = (url, image_path) =>
axios({
    url,
    responseType: 'stream',
}).then(
    response =>
    new Promise((resolve, reject) => {
        response.data
        .pipe(fs.createWriteStream(image_path))
        .on('finish', () => resolve())
        .on('error', e => reject(e));
    }),
);

const server = http.createServer(app)

server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${port}`)
})

// Обработка пост запроса на /download
app.post('/download-bing', function(req, res) {
    const zip = new require('node-zip')();
    // Принимаем все правила
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "1800");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods","PUT, POST, GET, DELETE, PATCH, OPTIONS");
    // Обработка POST запроса
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
            let bodyParse = parse(body);
            let data = JSON.parse(bodyParse.imgLinkInServer);
        // Создаем уникальное название будушему архиву+папке
        let dirName = uniqid()
        // Функция создания архива и загрузки картинок
        await (async function downloadFiles() {
            // Создаем папку 
            fs.mkdirSync(`server__/${dirName}`);
            // Проходимся по массиву с картинками
            for (const item of data) {
                const imageFormat = item.url.substr(-3, 3)
                console.log('Загрузка началась')
                // Скачиваем картинку  
                try {
                    let image = await download_image(item.url, `server__/${dirName}/${item.title}.${imageFormat}`)
                    console.log('Гучи флип флап')
                } catch (error) {
                    console.log('Не гучи флип флап')
                }
                console.log('Загрузка закончилась')

                // Добавляем картинки в список архива
                try {
                    zip.file(`${item.title}.${imageFormat}`, fs.readFileSync(path.join(__dirname + `/${dirName}`, `${item.title}.${imageFormat}`)));
                } catch (error) {
                    console.log('Ошибка, не удалось добавить картинку в архив')
                }
            }
            // Создаем архив с ранее сгенерированным названием
            const dataZIP = zip.generate({ base64:false, compression: 'DEFLATE' });
            fs.writeFileSync(__dirname + `/${dirName}.zip`, dataZIP, 'binary');
            // Удаляем ненужную папку с фотографиями
            try {
                fs.remove(`server__/${dirName}`)    
                console.log('Папка удалилась')
            } catch (error) {
                console.log(error)
            }
            
        }())

        // Создание ссылки для загрузки файла, по ссылке с уникальным названием файла
          app.get(`/${dirName}`, function(req, res) {
                // Получаем путь после слеша
                const filePath = path.join(__dirname + `/${dirName}.zip`); 
                // Возвращаем файл по ссылке
                fs.readFile(filePath, function(error, dataR){
                    console.log('Пробую отправить файл')
                    if(error){
                        console.log(error);
                        res.statusCode = 404;
                        res.end("Resourse not found!");
                    }   
                    else{
                        console.log('Файл успешно отправлен')
                        res.end(dataR);
                    }
                });
          });
          // Отправляем ссылку на фронтенд.
                res.json({ 'URL' : `${dirName}` }); 
          
    });
  });

app.post('/download-yandex', function(req, res) {
    const zip = new require('node-zip')();
    const imageUrlsName = imageUrls.length + 1;
    
    let imgUrls = imageUrls[imageUrlsName] = [];

    // Принимаем все правила
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "1800");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods","PUT, POST, GET, DELETE, PATCH, OPTIONS");
    // Обработка POST запроса
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
            let bodyParse = parse(body);
            let data = JSON.parse(bodyParse.urlFromParseInServer);
            let imageCount = JSON.parse(bodyParse.imageCountInServer);    
            // Создаем уникальное название будушему архиву+папке
            let dirName = uniqid()             
            // Функция создания архива и загрузки картинок

            let scrape = async () => {
                const browser = await puppeteer.launch({headless: true});
                const page = await browser.newPage();
                await page.goto(data)
                await page.evaluate(async (imageCount) => {
                    await new Promise((resolve, reject) => {
                        var totalHeight = 0;
                        var distance = 1000;
                        var timer = setInterval(() => {
                            if (!document.querySelector(`.serp-item`)) {
                                clearInterval(timer);
                                resolve();
                            }
                            var scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            console.log('Цикл интервала')
                            if(document.querySelector(`.serp-item_pos_${imageCount}`)){
                                console.log('Цикл должен выключиться ')
                                clearInterval(timer);
                                resolve();
                            }
                        }, 800);
                    });
                }, imageCount);
                const content = await page.content();
                const $ = cheerio.load(content);
                const image = $(".serp-item");
                image.each((index, element) => {
                    if (imgUrls.length < imageCount) {
                        console.log('Запушил одну картинку')
                        imgUrls.push({
                            title: JSON.parse(element.attribs['data-bem'])['serp-item'].snippet.title,
                            url: JSON.parse(element.attribs['data-bem'])['serp-item'].img_href
                        });
                    }
                });
                browser.close();
                return
            };
            
            scrape().then(async () => {
                if (imgUrls.length != 0 ) {
                    await (async function downloadFiles() {
                        // Создаем папку 
                        fs.mkdirSync(`server__/${dirName}`);
                        // Проходимся по массиву с картинками
                        for (const item of imgUrls) {
                            let imageFormat = `${item.url.substr(-3, 3)}`
                            console.log(item.url)
                            switch (imageFormat) {
                                case 'png':
                                    imageFormat = 'png'
                                    break;
                                
                                 case 'jpg':
                                    imageFormat = 'jpg'
                                    break;

                                case 'svg':
                                    imageFormat = 'svg'
                                    break;

                                case 'gif':
                                    imageFormat = 'gif'
                                    break;
                            
                                default:
                                    imageFormat = 'jpg'
                                    break;
                            }

                            console.log('Загрузка началась')
                            console.log('_______________________________________________________________')
                            // Скачиваем картинку  
                            try {
                                let image = await download_image(item.url, `server__/${dirName}/${item.title}.${imageFormat}`)
                                
                                console.log('Гучи флип флап')
                            } catch (error) {
                                console.log('Ошибка, не удалось скачать картинку')
                            }
                            console.log('Загрузка закончилась')
                            console.log('_______________________________________________________________')
                            // Добавляем картинки в список архива
                            try {
                                
                                zip.file(`${item.title}.${imageFormat}`, fs.readFileSync(path.join(__dirname + `/${dirName}`, `${item.title}.${imageFormat}`)));
                            } catch (error) {
                                console.log('Ошибка, не удалось добавить картинку в архив')
                            }
                        }
                        // Создаем архив с ранее сгенерированным названием
                        const dataZIP = zip.generate({ base64:false, compression: 'DEFLATE' });
                        fs.writeFileSync(__dirname + `/${dirName}.zip`, dataZIP, 'binary');
                        // Удаляем ненужную папку с фотографиями
                        try {
                            fs.remove(`server__/${dirName}`)    
                            console.log('Папка удалилась')
                        } catch (error) {
                            console.log(error)
                        }
                        
                    }())
                        // Создание ссылки для загрузки файла, по ссылке с уникальным названием файла
                    app.get(`/${dirName}`, function(req, res) {
                        // Получаем путь после слеша
                        const filePath = path.join(__dirname + `/${dirName}.zip`); 
                        // Возвращаем файл по ссылке
                        fs.readFile(filePath, function(error, dataR){
                            console.log('Пробую отправить файл')
                            if(error){
                                console.log(error);
                                res.statusCode = 404;
                                res.end("Resourse not found!");
                            }   
                            else{
                                console.log('Файл успешно отправлен')
                                res.end(dataR);
                            }
                        });
                    });
                    
                }
                
                // Отправляем ссылку на фронтенд.
                try {
                    if (imgUrls.length >= 1) {
                        res.json({'URL' : dirName , 'imageArray' : imgUrls}); 
                    } else {
                        res.json({'URL' : 'Картинок по вашему запросу не найдено' , 'imageArray' : imgUrls}); 
                    }
                    
                } catch (error) {
                    console.log(error)
                }
                imgUrls = [];
            });

    });
  });

