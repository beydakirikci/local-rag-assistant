---
title: RAG (Retrieval-Augmented Generation) Nedir?
category: RAG
id: rag-01
---

# RAG (Retrieval-Augmented Generation) Nedir?

Retrieval-Augmented Generation (RAG) veya Türkçe adıyla **Erişimle Artırılmış Üretim**, Büyük Dil Modellerinin (LLM) dış bilgi kaynaklarıyla desteklenerek daha doğru, güncel ve bağlama uygun yanıtlar üretmesini sağlayan hibrit bir yapay zeka mimarisidir.

Geleneksel LLM'ler yalnızca eğitim verilerindeki bilgilere erişebilir. Bu durum halüsinasyon (yanlış/uydurma bilgi üretme) ve güncel olmayan bilgi verme sorunlarına yol açar. RAG, dil modeline sorgu anında özel bir bilgi tabanından (vektör veritabanı) arama yapma yeteneği kazandırarak bu sorunu çözer.

## RAG Mimarisinin Çalışma Adımları

RAG süreci temel olarak iki aşamadan oluşur:

1. **Erişim (Retrieval) Aşaması:**
   - Kullanıcı bir soru sorar.
   - Kullanıcının sorusu bir gömme modeli (embedding model) aracılığıyla vektöre dönüştürülür.
   - Vektör veritabanında (ChromaDB, FAISS vb.) en yakın anlamsal benzerliğe sahip belgeler (chunks) bulunur ve getirilir.

2. **Üretim (Generation) Aşaması:**
   - Getirilen belge parçaları ve orijinal kullanıcı sorusu birleştirilerek zenginleştirilmiş bir istem (prompt) hazırlanır.
   - Büyük dil modeli bu bağlamı (context) okuyarak yalnızca doğruluk derecesi yüksek yanıtı oluşturur.

## RAG'in Avantajları

- **Halüsinasyonun Azaltılması:** Model kendi hafızasından uydurmak yerine sağlanan belgeler üzerinden yanıt verir.
- **Güncellik ve Özelleştirme:** Şirket içi belgeler, kılavuzlar veya güncel veriler modeli yeniden eğitmeden bilgi tabanına eklenebilir.
- **Kaynak Gösterme (Verifiability):** Yanıtların hangi belgelere dayandırıldığı izlenebilir.

## RAG ve Fine-Tuning Karşılaştırması

Fine-Tuning (İnce Ayar), modelin stilini ve formatını değiştirmek için harika bir yöntemken; RAG, yeni bilgi eklemek ve dinamik verilere erişmek için çok daha maliyetsiz, hızlı ve esnek bir çözümdür.
