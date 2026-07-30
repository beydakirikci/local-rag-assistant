---
title: Derin Öğrenme (Deep Learning)
category: Deep Learning
id: dl-01
---

# Derin Öğrenme (Deep Learning)

Derin Öğrenme, Makine Öğreniminin (Machine Learning) alt dalı olup, insan beyninin nöron yapısından esinlenilerek geliştirilen Yapay Sinir Ağları (Artificial Neural Networks - ANN) üzerine kurulu bir teknolojidir. Derin öğrenmeyi geleneksel makine öğreniminden ayıran en temel fark, büyük miktardaki verilerden nitelikleri (features) elle müdahale gerekmeksizin otomatik olarak öğrenebilmesidir.

## Yapay Sinir Ağlarının Yapısı

Derin bir sinir ağı temel olarak üç ana katmandan oluşur:

1. **Giriş Katmanı (Input Layer):** Ham verilerin (görüntü piksel değerleri, metin vektörleri vb.) sisteme alındığı katmandır.
2. **Gizli Katmanlar (Hidden Layers):** Veri üzerindeki karmaşık kalıpların ve temsil düzeylerinin öğrenildiği katmanlardır. Sistemde birden fazla (derin) gizli katman yer alır.
3. **Çıkış Katmanı (Output Layer):** Modelin tahmin veya sınıflandırma sonucunu ürettiği katmandır.

Her bir nöron, girdilerini ağırlıklar (weights) ve sapmalar (biases) ile çarparak toplar ve sonucu bir **Aktivasyon Fonksiyonu** (ReLU, Sigmoid, Softmax) aracılığıyla bir sonraki katmana aktarır. Model eğitimi sırasında **Geri Yayılım (Backpropagation)** ve **Ağırlık Güncelleme (Gradient Descent)** algoritmaları kullanılarak hata oranı minimize edilir.

## Öne Çıkan Derin Öğrenme Mimarileri

- **Evrişimli Sinir Ağları (CNN - Convolutional Neural Networks):** Özellikle bilgisayarlı görü (computer vision) alanında kullanılır. Görsellerdeki kenar, doku ve nesne gibi özellikleri filtrelerle tespit eder.
- **Yinelemeli Sinir Ağları (RNN - Recurrent Neural Networks):** Zaman serileri ve doğal dil gibi sıralı verileri işlemek için tasarlanmıştır. LSTM ve GRU gibi gelişmiş türleri uzun süreli bağımlılıkları korur.
- **Transformer Mimarisi:** RNN'lerin yerini alan, öz-dikkat (self-attention) mekanizmasıyla paralelleştirilebilir dil modellerine imkan sağlayan modern mimaridir.

## Uygulama Alanları

Derin öğrenme; otonom araçlarda nesne tespiti, tıbbi tanılama, ses tanıma (Siri, Alexa), otomatik çeviri ve üretken yapay zeka (Generative AI) uygulamalarında yaygın olarak tercih edilmektedir.
