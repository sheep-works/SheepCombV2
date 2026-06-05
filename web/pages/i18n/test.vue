<template>
  <div class="test-page-container">
    <h1>{{ $t('testPage.title') }}</h1>
    <p>{{ $t('testPage.description') }}</p>
    <p><strong>{{ $t('testPage.greeting') }}</strong></p>

    <div class="language-switcher">
      <label for="locale-select">{{ $t('testPage.language_switch') }}: </label>
      <select id="locale-select" :value="locale" @change="setLocale($event.target.value)">
        <option v-for="loc in locales" :key="loc.code" :value="loc.code">
          {{ loc.name }}
        </option>
      </select>
    </div>

    <div class="back-link">
      <NuxtLink to="/shuttle/constructor">← Shuttle Constructorへ</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { locale, locales, setLocale } = useI18n()
</script>

<style scoped>
.test-page-container {
  max-width: 600px;
  margin: 40px auto;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  font-family: sans-serif;
}

.language-switcher {
  margin-top: 30px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

select {
  padding: 5px 10px;
  font-size: 16px;
}

.back-link {
  margin-top: 30px;
}
</style>
