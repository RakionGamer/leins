const app = require('./app');

// definicion del puerto y entorno
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// iniciar servidor
app.listen(port, () => {
   if (isProd) {
      console.log(`server listening on ${port}`);
   } else {
      console.log('mi port: ' + port);
      console.log('zona horaria activa:', process.env.TZ);
      console.log('fecha/hora actual:', new Date());
   }
});