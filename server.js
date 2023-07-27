const { google } = require('googleapis');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());

const auth = new google.auth.GoogleAuth({
  keyFile: './googleConfig/key.json',
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const vision = google.vision('v1');

app.use(express.json());

app.post('/analyze-photos', upload.any(), async (req, res) => {
  try {
    const plateImagePath = req.files[0].path;
    const odometerImagePath = req.files[1].path;
    const fuelPumpImagePath = req.files[2].path;
    const fuelPumpImage2Path = req.files[3].path;

    const plateImageUrl = await uploadImageToStorage(plateImagePath);
    const odometerImageUrl = await uploadImageToStorage(odometerImagePath);
    const fuelPumpImageUrl = await uploadImageToStorage(fuelPumpImagePath);
    const fuelPumpImage2Url = await uploadImageToStorage(fuelPumpImage2Path);

    const plateInfo = await analyzeImage(plateImageUrl);
    const odometerInfo = await analyzeImage(odometerImageUrl);
    const fuelPumpInfo = await analyzeImage(fuelPumpImageUrl);
    const fuelPump2Info = await analyzeImage(fuelPumpImage2Url);

    removeFile(plateImagePath);
    removeFile(odometerImagePath);
    removeFile(fuelPumpImagePath);
    removeFile(fuelPumpImage2Path);

    res.json({
      plateInfo,
      odometerInfo,
      fuelPumpInfo,
      fuelPump2Info,
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Ocorreu um erro ao processar as imagens.' });
  }
});

async function uploadImageToStorage(imagePath) {
  const bucketName = 'arquivo-pdf-e-xml';
  const authClient = await auth.getClient();

  const storage = google.storage({
    version: 'v1',
    auth: authClient,
  });

  const fileName = `image_${Date.now()}.jpg`;

  const request = {
    bucket: bucketName,
    name: fileName,
    media: {
      body: fs.createReadStream(imagePath),
    },
  };

  await storage.objects.insert(request);

  const imageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
  return imageUrl;
}

const visionClient = new ImageAnnotatorClient({ keyFilename: './googleConfig/key.json' });

async function analyzeImage(imageUrl) {
  const [result] = await visionClient.textDetection(imageUrl);
  const annotations = result.textAnnotations;
  const text = annotations[0].description;

  return {
    text,
    imageUrl,
  };
}

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

function removeFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Erro ao excluir o arquivo:', err);
    }
  });
}

// ngrok http 3000 // para executar o tunel, modificar a rota