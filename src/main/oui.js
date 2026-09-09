'use strict';

// Mapa curado de prefijos OUI (primeros 3 octetos de la MAC, en mayusculas sin
// separadores) a fabricante. No es la base completa del IEEE (son ~30k
// entradas), pero cubre los fabricantes mas comunes en una red domestica:
// telefonos, PCs, consolas, TVs e IoT. Si un dispositivo no aparece, se marca
// como "Desconocido" pero igual se detecta por IP/MAC.

const OUI = {
  // Apple
  '000A27': 'Apple', 'F0189E': 'Apple', 'A85C2C': 'Apple', 'AC1F74': 'Apple',
  '3C0754': 'Apple', 'F4F15A': 'Apple', 'DC2B2A': 'Apple', '040CCE': 'Apple',
  '68AB1E': 'Apple', 'D0817A': 'Apple',
  // Samsung
  '5CF6DC': 'Samsung', '8425DB': 'Samsung', 'E8508B': 'Samsung', 'F409D8': 'Samsung',
  '38AA3C': 'Samsung', 'C4576E': 'Samsung', '78F882': 'Samsung', '00166B': 'Samsung',
  // Xiaomi
  '640980': 'Xiaomi', '7C1DD9': 'Xiaomi', 'F8A45F': 'Xiaomi', '286C07': 'Xiaomi',
  '3480B3': 'Xiaomi', '50EC50': 'Xiaomi', '8CBEBE': 'Xiaomi',
  // Huawei
  '00E0FC': 'Huawei', '48435A': 'Huawei', '5CF96A': 'Huawei', 'D0176A': 'Huawei',
  '78D752': 'Huawei', '10C61F': 'Huawei', 'AC4E91': 'Huawei',
  // Motorola / Lenovo
  '4448C1': 'Motorola', '3C43C3': 'Motorola', 'CCC3EA': 'Motorola',
  // Google
  'F4F5D8': 'Google', '3C5AB4': 'Google', 'A47733': 'Google', 'F88FCA': 'Google',
  // Intel (PCs/laptops)
  '00A0C9': 'Intel', '3C9709': 'Intel', '00219B': 'Intel', 'A0889F': 'Intel',
  '8C1645': 'Intel', '9CB6D0': 'Intel', 'E4A471': 'Intel',
  // TP-Link (routers/repetidores)
  '50C7BF': 'TP-Link', 'A42BB0': 'TP-Link', '1CFA68': 'TP-Link', 'EC086B': 'TP-Link',
  'C46E1F': 'TP-Link', '003192': 'TP-Link',
  // Realtek (adaptadores comunes)
  '52540': 'Realtek', '00E04C': 'Realtek',
  // Amazon (Echo/Fire)
  '68370E': 'Amazon', 'FC65DE': 'Amazon', '44650D': 'Amazon', '0C47C9': 'Amazon',
  // Sony (PlayStation)
  '000D3A': 'Sony', 'FC0FE6': 'Sony', 'A8E3EE': 'Sony',
  // Microsoft (Xbox/Surface)
  '000D3AC': 'Microsoft', '7C1E52': 'Microsoft', '582F40': 'Microsoft',
  // Nintendo
  '0009BF': 'Nintendo', '98B6E9': 'Nintendo', '7CBB8A': 'Nintendo',
  // LG
  '00E091': 'LG', 'A816B2': 'LG', 'C4438F': 'LG',
  // Nokia / Alcatel (routers ISP comunes en LatAm)
  '000FBB': 'Nokia', '9C28BF': 'Nokia',
  // ZTE (routers ISP, muy comunes en LatAm: F660/F680)
  '4C09B4': 'ZTE', 'D871B8': 'ZTE', '9CA9E4': 'ZTE', '301F48': 'ZTE',
  '344B50': 'ZTE', 'C4A366': 'ZTE', '8CE117': 'ZTE',
  // Espressif (IoT ESP32/ESP8266)
  '240AC4': 'Espressif IoT', '3C6105': 'Espressif IoT', 'A4CF12': 'Espressif IoT',
};

module.exports = { OUI };
