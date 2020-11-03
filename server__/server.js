// содежимое index.js
const app = require('express')()
const http = require('http');
const url = require('url');
const { parse } = require('querystring');
const port = 3000;
const fs = require('fs-extra')
const path = require('path');
const zip = new require('node-zip')();
const axios = require('axios');
const uniqid = require('uniqid');
const bodyParser  = require('body-parser');


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
app.post('/download', function(req, res) {
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
                console.log('Загрузка началась')
                // Скачиваем картинку  
                try {
                    let image = await download_image(item.url, `server__/${dirName}/${item.title}.png`)
                    console.log('Гучи флип флап')
                } catch (error) {
                    console.log('Ошибка, не удалось получить доступ к картинке')
                }
                console.log('Загрузка закончилась')

                // Добавляем картинки в список архива
                try {
                    zip.file(`${item.title}.png`, fs.readFileSync(path.join(__dirname + `/${dirName}`, `${item.title}.png`)));
                } catch (error) {
                    console.log('Ошибка, не удалось получить доступ к картинке')
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
                    console.log('Выполняется')
                    if(error){
                        console.log(error);
                        res.statusCode = 404;
                        res.end("Resourse not found!");
                    }   
                    else{
                        console.log('Response end')
                        res.end(dataR);
                    }
                });
          });
          // Отправляем ссылку на фронтенд.
          try {
              console.log('Все гуччи, юрл отправлен')
                res.json({ 'URL' : dirName }); 
          } catch (error) {
              console.log(error)
          }
          
    });
  });
