(function () {
  'use strict';

  var dictionaries = {
    en: {
      appearance: 'Appearance',
      background: 'Background',
      handles: 'Handles',
      flowPage: 'Flow Page',
      behavior: 'Behavior',
      flowSettings: 'Flow Settings',
      flowSettingsKicker: 'Flow / Settings',
      appearanceDescription: "Customize Flow's interface and graph colors.",
      backgroundDescription: 'Configure the extension gradient and graph media.',
      handlesDescription: 'Choose the graph handle shape, image, and size.',
      flowPageDescription: 'Choose which controls appear in the main Flow panel.',
      behaviorDescription: 'Control how Flow responds while you work.',
      interfaceColors: 'Interface Colors',
      interfaceColorsHint: 'Choose the colors used throughout the Flow panel.',
      uiTheme: 'UI / Theme Color',
      graphLine: 'Graph Line Color',
      handleNode: 'Handle & Node Color',
      homeIndicator: 'Home Indicator Color',
      quickPresets: 'Quick Presets',
      quickPresetsHint: 'Apply one color across the main Flow interface controls.',
      extensionGradient: 'Extension Background Gradient',
      extensionGradientHint: 'Blend two colors across the complete Flow panel.',
      backgroundColor1: 'Background Color 1',
      backgroundColor2: 'Background Color 2',
      gradientDirection: 'Gradient Direction',
      colourIntensity: 'Colour Intensity',
      graphBackgroundMedia: 'Graph Background Media',
      graphBackgroundMediaHint: 'Use an image, GIF, or video behind the graph.',
      clear: 'Clear',
      useOriginalMedia: 'Use Original Media Colors',
      dropMedia: 'Drop media here<br />or Browse',
      opacity: 'Opacity',
      mediaTip: 'Use low-resolution GIFs, videos, or images for optimal performance.',
      mediaChecking: 'Checking media…',
      mediaReady: 'Media ready.',
      mediaUnsupported: 'Unsupported file. Use H.264 MP4, PNG, JPG, or GIF.',
      mediaDecodeError: 'This file could not be decoded. Try H.264 MP4 (yuv420p), PNG, JPG, or GIF.',
      mediaReadError: 'Could not read this file.',
      mediaLargeWarning: 'Large media can slow Flow. Consider a smaller or lower-resolution file.',
      handleStyle: 'Handle Style',
      handleStyleHint: 'Select a preset shape or upload a custom PNG or GIF.',
      clearCustom: 'Clear Custom',
      heart: 'Heart',
      circle: 'Circle',
      square: 'Square',
      diamond: 'Diamond',
      star: 'Star',
      heartHandle: 'Heart handle',
      circleHandle: 'Circle handle',
      squareHandle: 'Square handle',
      diamondHandle: 'Diamond handle',
      starHandle: 'Star handle',
      uploadHandle: 'Upload a PNG or animated GIF handle',
      handleSize: 'Handle Size',
      handleLineThickness: 'Handle Line Thickness',
      easingControls: 'Easing Controls',
      easingControlsHint: 'Show only the easing direction controls you use.',
      showEaseOut: 'Show Ease Out',
      showEase: 'Show Ease',
      showEaseIn: 'Show Ease In',
      libraryToolbar: 'Library Toolbar',
      libraryToolbarHint: 'Choose the quick tools shown beside the preset library.',
      showMotionTools: 'Show Motion Tools',
      showExpressionMode: 'Show Expression Mode',
      showPreviewButton: 'Show Movement Preview Button',
      showEmojiBrowser: 'Show Emoji Browser',
      movementPreview: 'Movement Preview',
      movementPreviewHint: 'Control the preview strip above the preset library.',
      showPreviewBar: 'Show Movement Preview Bar',
      panelBehavior: 'Panel Behavior',
      panelBehaviorHint: 'Adjust automatic actions and panel visual helpers.',
      language: 'Language',
      languageHint: 'Choose the language used in Flow settings.',
      english: 'English',
      mandarin: 'Mandarin',
      thai: 'Thai',
      profile: 'Profile',
      profileDescription: 'Customize the profile shown in the Settings sidebar.',
      profileDetails: 'Profile Details',
      profileDetailsHint: 'Change your picture, display name, and bio.',
      resetProfile: 'Reset Profile',
      changePhoto: 'Change photo',
      profilePicture: 'Profile Picture',
      profilePictureHint: 'Upload a PNG, JPG, GIF, or WebP image.',
      useDefaultPhoto: 'Use Default Photo',
      profileName: 'Name',
      profileBio: 'Bio',
      profileAutosave: 'Profile changes are saved automatically.',
      autoApply: 'Auto Apply',
      applyShortcut: 'Apply Shortcut',
      applyShortcutHint: 'Double-press this key to apply the current graph.',
      changeApplyShortcut: 'Change Apply shortcut',
      resetApplyShortcut: 'Reset Apply shortcut',
      pressShortcutKey: 'Press a key…',
      liquidGlassApply: 'Liquid Glass Apply Button',
      motionToolTextLabels: 'Use Text Labels for Motion Tools',
      placeNewNullAtTop: 'Place New Null at Top',
      placeNewNullAtTopHint: 'When off, the null is placed directly above the selected layer.',
      hideHomeIndicator: 'Hide Home Indicator',
      rgbMode: 'RGB Mode',
      disableSnowflake: 'Disable Snowflake',
      backgroundEffect: 'Background Effect',
      backgroundEffectHint: 'Choose the ambient animation shown behind Flow.',
      snowfall: 'Snowfall',
      rainfall: 'Rain',
      glowingParticles: 'Particles',
      effectOff: 'Off',
      edit: 'Edit',
      close: 'Close'
    },
    zh: {
      appearance: '外观',
      background: '背景',
      handles: '控制点',
      flowPage: 'Flow 页面',
      behavior: '行为',
      flowSettings: 'Flow 设置',
      flowSettingsKicker: 'Flow / 设置',
      appearanceDescription: '自定义 Flow 的界面和曲线颜色。',
      backgroundDescription: '配置扩展背景渐变和曲线媒体。',
      handlesDescription: '选择曲线控制点的形状、图片和大小。',
      flowPageDescription: '选择主 Flow 面板中显示的控件。',
      behaviorDescription: '控制 Flow 工作时的行为。',
      interfaceColors: '界面颜色',
      interfaceColorsHint: '选择 Flow 面板中使用的颜色。',
      uiTheme: '界面 / 主题颜色',
      graphLine: '曲线颜色',
      handleNode: '控制点和节点颜色',
      homeIndicator: '主页指示器颜色',
      quickPresets: '快速预设',
      quickPresetsHint: '将一种颜色应用到 Flow 的主要界面控件。',
      extensionGradient: '扩展背景渐变',
      extensionGradientHint: '在整个 Flow 面板中混合两种颜色。',
      backgroundColor1: '背景颜色 1',
      backgroundColor2: '背景颜色 2',
      gradientDirection: '渐变方向',
      colourIntensity: '颜色强度',
      graphBackgroundMedia: '曲线背景媒体',
      graphBackgroundMediaHint: '在曲线后显示图片、GIF 或视频。',
      clear: '清除',
      useOriginalMedia: '使用媒体原始颜色',
      dropMedia: '将媒体拖放到这里<br />或浏览',
      opacity: '不透明度',
      mediaTip: '建议使用低分辨率 GIF、视频或图片以获得最佳性能。',
      mediaChecking: '正在检查媒体…',
      mediaReady: '媒体已就绪。',
      mediaUnsupported: '不支持此文件。请使用 H.264 MP4、PNG、JPG 或 GIF。',
      mediaDecodeError: '无法解码此文件。请尝试 H.264 MP4（yuv420p）、PNG、JPG 或 GIF。',
      mediaReadError: '无法读取此文件。',
      mediaLargeWarning: '大型媒体可能会降低 Flow 的速度。建议使用更小或更低分辨率的文件。',
      handleStyle: '控制点样式',
      handleStyleHint: '选择预设形状，或上传自定义 PNG/GIF。',
      clearCustom: '清除自定义',
      heart: '心形',
      circle: '圆形',
      square: '方形',
      diamond: '菱形',
      star: '星形',
      heartHandle: '心形控制点',
      circleHandle: '圆形控制点',
      squareHandle: '方形控制点',
      diamondHandle: '菱形控制点',
      starHandle: '星形控制点',
      uploadHandle: '上传 PNG 或动态 GIF 控制点',
      handleSize: '控制点大小',
      handleLineThickness: '控制线粗细',
      easingControls: '缓动控件',
      easingControlsHint: '仅显示你常用的缓动方向控件。',
      showEaseOut: '显示缓出',
      showEase: '显示双向缓动',
      showEaseIn: '显示缓入',
      libraryToolbar: '库工具栏',
      libraryToolbarHint: '选择预设库旁显示的快捷工具。',
      showMotionTools: '显示动作工具',
      showExpressionMode: '显示表达式模式',
      showPreviewButton: '显示动作预览按钮',
      showEmojiBrowser: '显示表情浏览器',
      movementPreview: '动作预览',
      movementPreviewHint: '控制预设库上方的预览条。',
      showPreviewBar: '显示动作预览条',
      panelBehavior: '面板行为',
      panelBehaviorHint: '调整自动操作和面板辅助显示。',
      language: '语言',
      languageHint: '选择 Flow 设置使用的语言。',
      english: '英语',
      mandarin: '普通话',
      thai: '泰语',
      profile: '个人资料',
      profileDescription: '自定义显示在设置侧栏中的个人资料。',
      profileDetails: '个人资料详情',
      profileDetailsHint: '更改头像、显示名称和简介。',
      resetProfile: '重置资料',
      changePhoto: '更换头像',
      profilePicture: '头像',
      profilePictureHint: '上传 PNG、JPG、GIF 或 WebP 图片。',
      useDefaultPhoto: '使用默认头像',
      profileName: '名称',
      profileBio: '简介',
      profileAutosave: '资料更改会自动保存。',
      autoApply: '自动应用',
      applyShortcut: '应用快捷键',
      applyShortcutHint: '双击此按键以应用当前曲线。',
      changeApplyShortcut: '更改应用快捷键',
      resetApplyShortcut: '重置应用快捷键',
      pressShortcutKey: '请按一个键…',
      liquidGlassApply: '液态玻璃应用按钮',
      motionToolTextLabels: '动作工具使用文字标签',
      placeNewNullAtTop: '将新建空对象置于顶层',
      placeNewNullAtTopHint: '关闭时，空对象会放在所选图层的正上方。',
      hideHomeIndicator: '隐藏主页指示器',
      rgbMode: 'RGB 模式',
      disableSnowflake: '禁用雪花效果',
      backgroundEffect: '背景效果',
      backgroundEffectHint: '选择显示在 Flow 背景中的环境动画。',
      snowfall: '降雪',
      rainfall: '雨滴',
      glowingParticles: '发光粒子',
      effectOff: '关闭',
      edit: '编辑',
      close: '关闭'
    },
    th: {
      appearance: 'รูปลักษณ์',
      background: 'พื้นหลัง',
      handles: 'จุดควบคุม',
      flowPage: 'หน้า Flow',
      behavior: 'การทำงาน',
      flowSettings: 'การตั้งค่า Flow',
      flowSettingsKicker: 'Flow / การตั้งค่า',
      appearanceDescription: 'ปรับแต่งหน้าตาและสีกราฟของ Flow',
      backgroundDescription: 'ตั้งค่าไล่สีพื้นหลังและสื่อของกราฟ',
      handlesDescription: 'เลือกรูปภาพ รูปทรง และขนาดจุดควบคุมกราฟ',
      flowPageDescription: 'เลือกตัวควบคุมที่จะแสดงในแผง Flow หลัก',
      behaviorDescription: 'ควบคุมการตอบสนองของ Flow ระหว่างทำงาน',
      interfaceColors: 'สีอินเทอร์เฟซ',
      interfaceColorsHint: 'เลือกสีที่ใช้ทั่วทั้งแผง Flow',
      uiTheme: 'สี UI / ธีม',
      graphLine: 'สีเส้นกราฟ',
      handleNode: 'สีจุดควบคุมและโหนด',
      homeIndicator: 'สีตัวบ่งชี้หน้าแรก',
      quickPresets: 'พรีเซ็ตด่วน',
      quickPresetsHint: 'ใช้สีเดียวกับตัวควบคุมหลักของ Flow',
      extensionGradient: 'ไล่สีพื้นหลังส่วนขยาย',
      extensionGradientHint: 'ผสมสองสีทั่วทั้งแผง Flow',
      backgroundColor1: 'สีพื้นหลัง 1',
      backgroundColor2: 'สีพื้นหลัง 2',
      gradientDirection: 'ทิศทางการไล่สี',
      colourIntensity: 'ความเข้มสี',
      graphBackgroundMedia: 'สื่อพื้นหลังกราฟ',
      graphBackgroundMediaHint: 'ใช้รูปภาพ GIF หรือวิดีโอด้านหลังกราฟ',
      clear: 'ล้าง',
      useOriginalMedia: 'ใช้สีดั้งเดิมของภาพ/วิดีโอ',
      dropMedia: 'วางสื่อที่นี่<br />หรือเรียกดู',
      opacity: 'ความทึบ',
      mediaTip: 'ใช้ GIF วิดีโอ หรือรูปภาพความละเอียดต่ำเพื่อประสิทธิภาพที่ดีที่สุด',
      mediaChecking: 'กำลังตรวจสอบสื่อ…',
      mediaReady: 'สื่อพร้อมใช้งาน',
      mediaUnsupported: 'ไม่รองรับไฟล์นี้ โปรดใช้ H.264 MP4, PNG, JPG หรือ GIF',
      mediaDecodeError: 'ไม่สามารถถอดรหัสไฟล์นี้ได้ โปรดลอง H.264 MP4 (yuv420p), PNG, JPG หรือ GIF',
      mediaReadError: 'ไม่สามารถอ่านไฟล์นี้ได้',
      mediaLargeWarning: 'ไฟล์สื่อขนาดใหญ่อาจทำให้ Flow ช้าลง ควรใช้ไฟล์ที่เล็กกว่าหรือความละเอียดต่ำกว่า',
      handleStyle: 'รูปแบบจุดควบคุม',
      handleStyleHint: 'เลือกรูปทรงพรีเซ็ต หรืออัปโหลด PNG/GIF แบบกำหนดเอง',
      clearCustom: 'ล้างแบบกำหนดเอง',
      heart: 'หัวใจ',
      circle: 'วงกลม',
      square: 'สี่เหลี่ยม',
      diamond: 'เพชร',
      star: 'ดาว',
      heartHandle: 'จุดควบคุมรูปหัวใจ',
      circleHandle: 'จุดควบคุมวงกลม',
      squareHandle: 'จุดควบคุมสี่เหลี่ยม',
      diamondHandle: 'จุดควบคุมรูปเพชร',
      starHandle: 'จุดควบคุมรูปดาว',
      uploadHandle: 'อัปโหลดจุดควบคุม PNG หรือ GIF แบบเคลื่อนไหว',
      handleSize: 'ขนาดจุดควบคุม',
      handleLineThickness: 'ความหนาเส้นควบคุม',
      easingControls: 'ตัวควบคุม Easing',
      easingControlsHint: 'แสดงเฉพาะทิศทาง Easing ที่คุณใช้',
      showEaseOut: 'แสดง Ease Out',
      showEase: 'แสดง Ease',
      showEaseIn: 'แสดง Ease In',
      libraryToolbar: 'แถบเครื่องมือไลบรารี',
      libraryToolbarHint: 'เลือกเครื่องมือด่วนที่แสดงข้างไลบรารีพรีเซ็ต',
      showMotionTools: 'แสดง Motion Tools',
      showExpressionMode: 'แสดงโหมด Expression',
      showPreviewButton: 'แสดงปุ่มพรีวิวการเคลื่อนไหว',
      showEmojiBrowser: 'แสดงเบราว์เซอร์อีโมจิ',
      movementPreview: 'พรีวิวการเคลื่อนไหว',
      movementPreviewHint: 'ควบคุมแถบพรีวิวเหนือไลบรารีพรีเซ็ต',
      showPreviewBar: 'แสดงแถบพรีวิวการเคลื่อนไหว',
      panelBehavior: 'การทำงานของแผง',
      panelBehaviorHint: 'ปรับการทำงานอัตโนมัติและตัวช่วยของแผง',
      language: 'ภาษา',
      languageHint: 'เลือกภาษาที่ใช้ในการตั้งค่า Flow',
      english: 'อังกฤษ',
      mandarin: 'จีนกลาง',
      thai: 'ไทย',
      profile: 'โปรไฟล์',
      profileDescription: 'ปรับแต่งโปรไฟล์ที่แสดงในแถบด้านข้างการตั้งค่า',
      profileDetails: 'รายละเอียดโปรไฟล์',
      profileDetailsHint: 'เปลี่ยนรูปโปรไฟล์ ชื่อที่แสดง และประวัติ',
      resetProfile: 'รีเซ็ตโปรไฟล์',
      changePhoto: 'เปลี่ยนรูป',
      profilePicture: 'รูปโปรไฟล์',
      profilePictureHint: 'อัปโหลดรูป PNG, JPG, GIF หรือ WebP',
      useDefaultPhoto: 'ใช้รูปเริ่มต้น',
      profileName: 'ชื่อ',
      profileBio: 'ประวัติ',
      profileAutosave: 'บันทึกการเปลี่ยนแปลงโปรไฟล์โดยอัตโนมัติ',
      autoApply: 'ใช้โดยอัตโนมัติ',
      applyShortcut: 'ปุ่มลัดสำหรับใช้กราฟ',
      applyShortcutHint: 'กดปุ่มนี้สองครั้งเพื่อใช้กราฟปัจจุบัน',
      changeApplyShortcut: 'เปลี่ยนปุ่มลัดสำหรับใช้กราฟ',
      resetApplyShortcut: 'รีเซ็ตปุ่มลัดสำหรับใช้กราฟ',
      pressShortcutKey: 'กดปุ่มใดก็ได้…',
      liquidGlassApply: 'ปุ่มใช้แบบกระจกเหลว',
      motionToolTextLabels: 'ใช้ป้ายข้อความสำหรับเครื่องมือโมชั่น',
      placeNewNullAtTop: 'วาง Null ใหม่ไว้บนสุด',
      placeNewNullAtTopHint: 'เมื่อปิด Null จะถูกวางไว้เหนือเลเยอร์ที่เลือกโดยตรง',
      hideHomeIndicator: 'ซ่อนตัวบ่งชี้หน้าแรก',
      rgbMode: 'โหมด RGB',
      disableSnowflake: 'ปิดเกล็ดหิมะ',
      backgroundEffect: 'เอฟเฟกต์พื้นหลัง',
      backgroundEffectHint: 'เลือกภาพเคลื่อนไหวบรรยากาศด้านหลัง Flow',
      snowfall: 'หิมะตก',
      rainfall: 'ฝนตก',
      glowingParticles: 'อนุภาคเรืองแสง',
      effectOff: 'ปิด',
      edit: 'แก้ไข',
      close: 'ปิด'
    }
  };

  var currentLanguage = 'en';

  function normalizeLanguage(value) {
    value = String(value || '').toLowerCase();
    return value === 'zh' || value === 'th' ? value : 'en';
  }

  function getText(key) {
    var language = dictionaries[currentLanguage] || dictionaries.en;
    return language[key] || dictionaries.en[key] || key;
  }

  function refreshSection(name) {
    var section = name ? document.querySelector('[data-settings-section="' + name + '"]') : document.querySelector('[data-settings-section].is-active');
    var title = document.getElementById('settingsSectionTitle');
    var description = document.getElementById('settingsSectionDescription');

    if (!section) {
      return;
    }

    if (title) {
      title.textContent = getText(section.getAttribute('data-settings-title-key')) || section.getAttribute('data-settings-title') || 'Settings';
    }

    if (description) {
      description.textContent = getText(section.getAttribute('data-settings-description-key')) || section.getAttribute('data-settings-description') || '';
    }

    document.title = 'Flow Settings - ' + (title ? title.textContent : 'Settings');
  }

  function apply(language) {
    var selected = document.getElementById('settingsLanguage');
    currentLanguage = normalizeLanguage(language || (selected && selected.value) || currentLanguage);

    if (selected && selected.value !== currentLanguage) {
      selected.value = currentLanguage;
    }

    document.documentElement.setAttribute('lang', currentLanguage === 'zh' ? 'zh-CN' : currentLanguage);

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i += 1) {
      var key = nodes[i].getAttribute('data-i18n');
      var value = getText(key);
      if (nodes[i].getAttribute('data-i18n-html') === 'true') {
        nodes[i].innerHTML = value;
      } else {
        nodes[i].textContent = value;
      }
    }

    var ariaNodes = document.querySelectorAll('[data-i18n-aria]');
    for (var j = 0; j < ariaNodes.length; j += 1) {
      ariaNodes[j].setAttribute('aria-label', getText(ariaNodes[j].getAttribute('data-i18n-aria')));
    }

    refreshSection();
  }

  window.FlowSettingsI18n = {
    apply: apply,
    getText: getText,
    getCurrent: function () {
      return currentLanguage;
    },
    refreshSection: refreshSection
  };

  apply();
})();
