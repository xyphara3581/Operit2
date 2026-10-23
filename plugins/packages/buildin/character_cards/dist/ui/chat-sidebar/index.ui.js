// @operit-compose-artifact 2
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/ui/chat-sidebar/index.ui.ts
var index_ui_exports = {};
__export(index_ui_exports, {
  default: () => Screen
});
module.exports = __toCommonJS(index_ui_exports);

// src/validation.ts
function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} \u5FC5\u987B\u662F\u5BF9\u8C61`);
}
function assertString(value, label) {
  if (typeof value !== "string") throw new Error(`${label} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
}
function requireId(value, label) {
  assertString(value, label);
  if (value.trim() === "" || value !== value.trim()) throw new Error(`${label} \u65E0\u6548`);
  return value;
}

// src/chat-bindings.ts
function parseChatSelection(selection) {
  requireId(selection, "chat selection");
  const parsed = /^(card|group|model):([^\s]+)$/u.exec(selection);
  if (parsed === null) throw new Error("Invalid plugin chat selection: " + selection);
  const kind = parsed[1];
  if (kind === "model" && parsed[2] !== "chat") throw new Error("Invalid model selection: " + selection);
  if (kind !== "card" && kind !== "group" && kind !== "model") throw new Error("Invalid chat selection kind: " + kind);
  return { kind, id: parsed[2] };
}
function selectionForActive(active) {
  if ("Model" in active) return "model:chat";
  if ("CharacterCard" in active) return "card:" + active.CharacterCard.id;
  return "group:" + active.CharacterGroup.id;
}

// src/chat-markers.ts
function markerValue(value, path) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(path + " must be a finite JSON number");
    return value;
  }
  if (Array.isArray(value)) return value.map(
    /** Validates and copies every actual nested JSON value. */
    (item, index) => markerValue(item, path + "[" + index + "]")
  );
  return markerObject(value, path);
}
function markerObject(value, path) {
  assertObject(value, path);
  const result = {};
  for (const [key, item] of Object.entries(value)) Object.defineProperty(result, key, { value: markerValue(item, path + "." + key), enumerable: true, configurable: true, writable: true });
  return result;
}

// src/domain.ts
function record(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be a JSON object`);
  return value;
}
function text(value, path) {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
}
function nonblank(value, path) {
  text(value, path);
  if (value.trim() === "") throw new Error(`${path} must not be blank`);
}
function parseMemoryIdentifier(value, path, _positive = true) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim() || value.length > 256) throw new Error(`${path} must be a nonblank identity`);
  return value;
}
function memoryIdentifier(value, path) {
  parseMemoryIdentifier(value, path);
}
function propertyIdentifier(value, path) {
  parseMemoryIdentifier(value, path, false);
}
function boolean(value, path) {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
}
function number(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be a finite number`);
}
function integer(value, path) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${path} must be a safe integer`);
}
function nonnegativeInteger(value, path) {
  integer(value, path);
  nonnegative(value, path);
}
function messageVariant(value, path) {
  integer(value, path);
  if (typeof value !== "number" || value < 0 || value > 2147483647) throw new Error(path + " must be a nonnegative i32 message variant index");
}
function score(value, path) {
  number(value, path);
  if (value < 0 || value > 1) throw new Error(`${path} must be between 0 and 1`);
}
function nonnegative(value, path) {
  number(value, path);
  if (value < 0) throw new Error(`${path} must not be negative`);
}
function enumeration(...values) {
  const allowed = new Set(values);
  return (value, path) => {
    if (typeof value !== "string" || !allowed.has(value)) throw new Error(`${path} must be ${values.join(" | ")}`);
  };
}
function nullable(validate) {
  return (value, path) => {
    if (value !== null) validate(value, path);
  };
}
function array(validate) {
  return (value, path) => {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    for (let index = 0; index < value.length; index += 1) validate(value[index], `${path}[${index}]`);
  };
}
function required(validate) {
  return { validate, required: true };
}
function optional(validate) {
  return { validate, required: false };
}
function shape(fields2, nonempty = false) {
  return (value, path) => {
    const object = record(value, path);
    const keys = Object.keys(object);
    if (nonempty && keys.length === 0) throw new Error(`${path} must contain at least one field`);
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(fields2, key)) throw new Error(`${path}.${key} is not a supported field`);
      fields2[key].validate(object[key], `${path}.${key}`);
    }
    for (const key of Object.keys(fields2)) {
      if (fields2[key].required && !Object.prototype.hasOwnProperty.call(object, key)) throw new Error(`${path}.${key} is required`);
    }
  };
}
function owner(value, path) {
  if (typeof value !== "string" || !/^(character|shared):[^:\s]+$/.test(value)) throw new Error(`${path} must be character:<id> or shared:<id>`);
}
var strings = array(text);
var identifiers = array(nonblank);
var member = shape({ characterCardId: required(nonblank), orderIndex: required(integer) });
var mount = shape({ sharedMemoryId: required(nonblank), readable: required(boolean), writable: required(boolean) });
var toolAccess = shape({ enabled: required(boolean), allowedBuiltinTools: required(strings), allowedPackages: required(strings), allowedSkills: required(strings), allowedMcpServers: required(strings) });
var property = shape({ id: required(propertyIdentifier), key: required(text), value: required(text) });
var characterFields = {
  name: optional(nonblank),
  description: optional(text),
  characterSetting: optional(text),
  openingStatement: optional(text),
  otherContentChat: optional(text),
  otherContentVoice: optional(text),
  avatarUri: optional(nullable(text)),
  attachedTagIds: optional(identifiers),
  advancedCustomPrompt: optional(text),
  marks: optional(text),
  chatModelBindingMode: optional(enumeration("FOLLOW_GLOBAL", "FIXED_MODEL")),
  chatModelId: optional(nullable(text)),
  chatProviderId: optional(nullable(text)),
  ttsConfigId: optional(nullable(text)),
  themeConfigId: optional(nullable(text)),
  memoryBindingMode: optional(enumeration("CHARACTER", "SHARED")),
  sharedMemoryId: optional(nullable(text)),
  sharedMemoryMounts: optional(array(mount)),
  toolAccessConfig: optional(toolAccess),
  createdAt: optional(integer),
  updatedAt: optional(integer)
};
var groupFields = { name: optional(nonblank), description: optional(text), themeConfigId: optional(nullable(text)), members: optional(array(member)), createdAt: optional(integer), updatedAt: optional(integer) };
var tagFields = { name: optional(nonblank), description: optional(text), promptContent: optional(text), tagType: optional(enumeration("TONE", "CHARACTER", "FUNCTION", "CUSTOM")), createdAt: optional(integer), updatedAt: optional(integer) };
var memoryFields = {
  uuid: optional(text),
  title: optional(nonblank),
  content: optional(text),
  contentType: optional(text),
  source: optional(text),
  credibility: optional(score),
  importance: optional(score),
  documentPath: optional(nullable(text)),
  isDocumentNode: optional(boolean),
  chunkIndexFilePath: optional(nullable(text)),
  folderPath: optional(nullable(text)),
  createdAt: optional(integer),
  updatedAt: optional(integer),
  lastAccessedAt: optional(integer),
  tags: optional(strings),
  properties: optional(array(property))
};
var settings = shape({
  autoSaveIntervalMinutes: required(nonnegative),
  nextAutoSaveRunAtMs: required(integer),
  memoryExtractionCustomRules: required(text),
  profileAutoUpdateEnabled: required(boolean),
  profileAutoUpdateLocked: required(boolean),
  cloudEmbeddingEnabled: required(boolean),
  cloudEmbeddingEndpoint: required(text),
  cloudEmbeddingApiKey: required(text),
  cloudEmbeddingModel: required(text)
});
var searchConfig = shape({ scoreMode: required(enumeration("BALANCED", "KEYWORD_FIRST", "SEMANTIC_FIRST")), keywordWeight: required(nonnegative), tagWeight: required(nonnegative), vectorWeight: required(nonnegative), edgeWeight: required(nonnegative) });
var empty = shape({});
var id = shape({ id: required(nonblank) });
var ownerOnly = shape({ ownerKey: required(owner) });
var contentOnly = shape({ content: required(text) });
var format = enumeration("operit", "tavern");
var memoryQueryRequest = shape({ participantId: required(nonblank), query: required(nonblank), limit: required(nonnegative), snapshotId: required(nullable(nonblank)) });
var validators = {
  "memory.chunks": shape({ ownerKey: required(owner), memoryId: required(nonblank), query: required(nonblank), count: required(nonnegativeInteger) }),
  "memory.searchWithOptions": shape({ ownerKey: required(owner), query: required(nonblank), folderPath: required(nullable(text)), relevanceThreshold: required(nonnegative), createdAtStartMs: required(nullable(integer)), createdAtEndMs: required(nullable(integer)) }),
  "memory.chat.list": ownerOnly,
  "memory.chat.pruneMissing": ownerOnly,
  "memory.chat.update": shape({ ownerKey: required(owner), chatId: required(nonblank) }),
  "memory.categorize": ownerOnly,
  "memory.rebuild.start": shape({ ownerKey: required(owner), rebuild: required(shape({ chatIds: required(strings), windowMessageCount: required(integer), fromInclusive: required(nullable(integer)), toInclusive: required(nullable(integer)) })) }),
  "memory.rebuild.progress": ownerOnly,
  "memory.rebuild.cancel": ownerOnly,
  "memory.embeddings.rebuild": ownerOnly,
  "memory.candidate.enqueue": shape({ chatId: required(nonblank), timestamp: required(integer), variantIndex: required(messageVariant), sourceType: required(enumeration("reply_finalized_auto", "selected_user_message")), ownerKey: required(nullable(owner)) }),
  "chat.configuration.resolve": parseChatConfigurationRequest,
  "chat.configuration.binding.read": shape({ chatId: required(nonblank) }),
  "chat.configuration.binding.write": shape({ chatId: required(nonblank), selection: required(nonblank) }),
  "chat.configuration.binding.delete": shape({ chatId: required(nonblank) }),
  snapshot: empty,
  "character.list": empty,
  "character.get": id,
  "character.create": shape({ values: required(shape({ ...characterFields, id: optional(text), name: required(nonblank) })) }),
  "character.update": shape({ id: required(nonblank), changes: required(shape(characterFields, true)) }),
  "character.delete": id,
  "character.setActive": id,
  "character.combine": shape({ id: required(nonblank), promptFunctionType: optional(enumeration("CHAT", "VOICE")), additionalTagIds: optional(identifiers) }),
  "character.export": shape({ id: required(nonblank), format: required(format) }),
  "character.import": shape({ format: required(format), content: required(nonblank) }),
  "character.exportBackup": empty,
  "character.importBackup": contentOnly,
  "group.list": empty,
  "group.get": id,
  "group.create": shape({ values: required(shape({ ...groupFields, id: optional(text), name: required(nonblank) })) }),
  "group.update": shape({ id: required(nonblank), changes: required(shape(groupFields, true)) }),
  "group.delete": id,
  "group.setActive": id,
  "group.duplicate": shape({ id: required(nonblank), newName: optional(nonblank) }),
  "group.export": id,
  "group.import": contentOnly,
  "group.exportBackup": empty,
  "group.importBackup": contentOnly,
  "activePrompt.get": empty,
  "activePrompt.setModel": empty,
  "activePrompt.setCard": id,
  "activePrompt.setGroup": id,
  "activePrompt.activateForChat": shape({ characterCardName: required(nullable(nonblank)), characterGroupId: required(nullable(nonblank)) }),
  "activePrompt.resolvedCard": empty,
  "tag.list": empty,
  "tag.get": id,
  "tag.create": shape({ values: required(shape({ ...tagFields, id: optional(text), name: required(nonblank) })) }),
  "tag.update": shape({ id: required(nonblank), changes: required(shape(tagFields, true)) }),
  "tag.delete": id,
  "memory.shared.list": empty,
  "memory.shared.create": shape({ name: required(nonblank) }),
  "memory.shared.rename": shape({ id: required(nonblank), name: required(nonblank) }),
  "memory.shared.delete": id,
  "memory.mount": shape({ characterId: required(nonblank), sharedId: required(nonblank), readable: required(boolean), writable: required(boolean) }),
  "memory.unmount": shape({ characterId: required(nonblank), sharedId: required(nonblank) }),
  "memory.user.read": ownerOnly,
  "memory.user.write": shape({ ownerKey: required(owner), content: required(text) }),
  "memory.user.path": ownerOnly,
  "memory.resolveOwner": shape({ characterId: required(nonblank) }),
  "memory.settings.read": ownerOnly,
  "memory.settings.write": shape({ ownerKey: required(owner), settings: required(settings) }),
  "memory.searchConfig.read": ownerOnly,
  "memory.searchConfig.write": shape({ ownerKey: required(owner), config: required(searchConfig) }),
  "memory.graph": ownerOnly,
  "memory.list": ownerOnly,
  "memory.search": shape({ ownerKey: required(owner), query: required(nonblank) }),
  "memory.get": shape({ ownerKey: required(owner), title: required(nonblank) }),
  "memory.create": shape({ ownerKey: required(owner), values: required(shape({ ...memoryFields, id: optional(memoryIdentifier), title: required(nonblank), content: required(text) })) }),
  "memory.update": shape({ ownerKey: required(owner), originalTitle: required(nonblank), expectedId: optional(memoryIdentifier), changes: required(shape(memoryFields, true)) }),
  "memory.delete": shape({ ownerKey: required(owner), id: required(memoryIdentifier) }),
  "memory.move": shape({ ownerKey: required(owner), ids: required(array(memoryIdentifier)), folderPath: required(text) }),
  "memory.link.create": shape({ ownerKey: required(owner), sourceTitle: required(nonblank), targetTitle: required(nonblank), linkType: required(nonblank), weight: required(score), description: required(text) }),
  "memory.link.update": shape({ ownerKey: required(owner), linkId: required(memoryIdentifier), changes: required(shape({ linkType: optional(nonblank), weight: optional(score), description: optional(text) }, true)) }),
  "memory.link.delete": shape({ ownerKey: required(owner), linkId: required(memoryIdentifier) }),
  "memory.export": ownerOnly,
  "memory.import": shape({ ownerKey: required(owner), content: required(nonblank), strategy: required(enumeration("SKIP", "UPDATE", "CREATE_NEW")) })
};
function parseDomainPayload(operation, payload) {
  if (!Object.prototype.hasOwnProperty.call(validators, operation)) throw new Error(`Unknown character domain operation: ${String(operation)}`);
  validators[operation](payload, operation);
  return payload;
}
function parseChatConfigurationRequest(value) {
  shape({
    purpose: required(enumeration("display", "execution")),
    chatId: required(nullable(nonblank)),
    chatExtension: required(nullable(markerObject)),
    participantId: required(nullable(nonblank)),
    promptFunctionType: required(enumeration("CHAT", "VOICE")),
    defaultModelBinding: required(shape({ providerId: required(text), modelId: required(text) })),
    defaultTtsConfigId: required(text)
  })(value, "chat.configuration.resolve");
  const request = value;
  if (request.purpose === "display") {
    if (request.participantId !== null) throw new Error("Display configuration cannot request an execution participant");
  } else {
    nonblank(request.defaultModelBinding.providerId, "execution default provider");
    nonblank(request.defaultModelBinding.modelId, "execution default model");
    nonblank(request.defaultTtsConfigId, "execution default TTS configuration");
  }
  return request;
}

// src/definition.ts
var definition = { id: "com.operit.character_cards", title: "\u89D2\u8272\u5361", icon: "Badge", order: 150 };
var chatUiRoutes = {
  editor: `toolpkg:${definition.id}:ui:main`,
  selection: `toolpkg:${definition.id}:ui:selection`,
  execution: `toolpkg:${definition.id}:ui:group-execution`
};

// src/ui-contributions.ts
function callMainDomain(operation, input) {
  const checked = parseDomainPayload(operation, input);
  return ToolPkg.ipc.call("character-memory.domain", { operation, input: checked }, { targetRuntime: "main" });
}
function encodeSelection(selection) {
  return selectionForActive(selection);
}

// src/chat-lifecycle.ts
var CHARACTER_CARDS_NAMESPACE = "com.operit.character_cards";
function fields(value, keys, label) {
  const input = record(value, label), actual = Object.keys(input);
  if (actual.length !== keys.length || actual.some(
    /** Rejects undocumented fields rather than guessing their meaning or owner. */
    (key) => keys.indexOf(key) === -1
  )) throw new Error(label + " has invalid fields");
  return input;
}
function identity(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(label + " must be a nonblank string");
  return value;
}
function parseChatSelectionMarker(value, label) {
  const marker = fields(value, ["version", "selection"], label);
  if (marker.version !== 1) throw new Error(label + ".version must be 1");
  const selection = identity(marker.selection, label + ".selection");
  parseChatSelection(selection);
  return { version: 1, selection };
}
function createChatInput(selection) {
  const marker = parseChatSelectionMarker({ version: 1, selection }, "chat creation selection");
  return { [CHARACTER_CARDS_NAMESPACE]: { version: 1, selection: marker.selection } };
}

// src/sidebar-chat-tree.ts
var SidebarChatTree = class {
  /** Rejects duplicate identities and cycles before any recursive rows are rendered. */
  constructor(chats) {
    this.roots = /* @__PURE__ */ new Set();
    this.children = /* @__PURE__ */ new Map();
    const ids = new Set(chats.map((chat) => chat.id));
    if (ids.size !== chats.length) throw new Error("Duplicate conversation id");
    for (const chat of chats) this.children.set(chat.id, []);
    for (const chat of chats) {
      if (chat.parentChatId === null || !ids.has(chat.parentChatId)) this.roots.add(chat.id);
      else this.children.get(chat.parentChatId).push(chat);
    }
    const visiting = /* @__PURE__ */ new Set(), visited = /* @__PURE__ */ new Set();
    const visit = (chat) => {
      if (visited.has(chat.id)) return;
      if (visiting.has(chat.id)) throw new Error("Cyclic conversation parent: " + chat.id);
      visiting.add(chat.id);
      for (const child of this.children.get(chat.id)) visit(child);
      visiting.delete(chat.id);
      visited.add(chat.id);
    };
    for (const chat of chats) visit(chat);
  }
  /** Retains the complete ancestor path of every matching descendant. */
  matching(chats, predicate) {
    const result = /* @__PURE__ */ new Set();
    const visit = (chat) => {
      let matches = predicate(chat);
      for (const child of this.children.get(chat.id)) matches = visit(child) || matches;
      if (matches) result.add(chat.id);
      return matches;
    };
    for (const chat of chats) if (this.roots.has(chat.id)) visit(chat);
    return result;
  }
};

// src/ui-sidebar-native-layout.ts
var legacySidebarMetrics = Object.freeze({
  categoryStart: 20,
  categoryEnd: 12,
  categoryAvatar: 22,
  categoryRadius: 18,
  groupStart: 46,
  groupEnd: 12,
  groupRadius: 12,
  chatStart: 56,
  chatEnd: 12,
  chatHeight: 34,
  chatRadius: 8,
  railWidth: 20,
  swipeIconSize: 18,
  createHeight: 34,
  createRadius: 17,
  previewLimit: 4
});
function sidebarRowBuilders(ctx, current, state, actions, defaultAvatar) {
  const colors = ctx.MaterialTheme.colorScheme, m = legacySidebarMetrics;
  const query = state.query.trim().toLocaleLowerCase();
  const muted = colors.onSurfaceVariant.copy({ alpha: 0.8 });
  const rows = [];
  const tree = new SidebarChatTree(current.chatSidebar.chats);
  const matching = tree.matching(current.chatSidebar.chats, (chat) => query === "" || chat.title.toLocaleLowerCase().includes(query));
  function dragType(section) {
    return "character-sidebar.chat:" + section.id;
  }
  const gap = (width) => OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:22009",[width],__operitUiTemplate_22009);
  function more(kind, id2, selected = false) {
    return OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:22093",["sidebar-" + kind + "-menu-" + id2 + "-visibility",selected,actions.menu(kind, id2)],__operitUiTemplate_22093);
  }
  function chatRow(chat, section, groupId, depth = 0) {
    const selected = current.chatSidebar.currentChatId === chat.id;
    const titleColor = selected ? colors.onSecondaryContainer : muted;
    const running = current.chatSidebar.activeStreamingChatIds.includes(chat.id);
    const status = OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:22540",["sidebar-status-" + chat.id,running,selected,selected ? colors.onSecondaryContainer.copy({ alpha: 0.7 }) : colors.onSurfaceVariant.copy({ alpha: 0.3 }),colors.primary],__operitUiTemplate_22540);
    const content = [OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:22861",["sidebar-chat-drag-" + chat.id,chat.id,dragType(section),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:23016",[colors.surfaceContainerHighest,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:23206",[chat.title,colors.onSurface],__operitUiTemplate_23206)],__operitUiTemplate_23016),status],__operitUiTemplate_22861), gap(5), OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:23357",[{
      key: "sidebar-chat-title-" + chat.id,
      text: chat.title,
      weight: 1,
      fontSize: 13,
      fontWeight: selected ? "600" : "400",
      maxLines: 1,
      overflow: "ellipsis",
      color: titleColor,
      ...{ letterSpacing: -0.1 }
    }],__operitUiTemplate_23357)];
    if (chat.pinned) content.push(gap(5), OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:23676",[titleColor.copy ? titleColor.copy({ alpha: 0.6 }) : titleColor],__operitUiTemplate_23676));
    if (chat.locked) content.push(gap(5), OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:23833",[titleColor.copy ? titleColor.copy({ alpha: 0.6 }) : titleColor],__operitUiTemplate_23833));
    const children = tree.children.get(chat.id);
    if (children.length > 0) {
      const expanded = query !== "" || state.expandedGroups.includes("children:" + chat.id);
      content.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:24137",["sidebar-children-" + chat.id,expanded ? "ExpandLess" : "ExpandMore",expanded ? "\u6536\u8D77\u5B50\u4F1A\u8BDD" : "\u5C55\u5F00\u5B50\u4F1A\u8BDD\uFF08" + children.length + "\uFF09",() => actions.toggleGroup("children:" + chat.id)],__operitUiTemplate_24137));
    }
    content.push(gap(4), more("chat", chat.id, selected));
    const surface = OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:24671",["sidebar-chat-hit-" + chat.id,ctx.Modifier.clip({ cornerRadius: m.chatRadius }).background(colors.secondaryContainer.copy({ alpha: selected ? 0.78 : 0 }), { cornerRadius: m.chatRadius }).border(1, colors.onSecondaryContainer.copy({ alpha: selected ? 0.08 : 0 }), { cornerRadius: m.chatRadius }).combinedClickable({ onClick: () => actions.activate(chat.id), onLongClick: () => actions.longPress(chat.id) }),content],__operitUiTemplate_24671);
    const indicatorColor = selected ? colors.primary : colors.onSurface.copy({ alpha: 0 });
    const rail = OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:25506",["sidebar-chat-rail-" + chat.id,m.railWidth,m.chatHeight,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:25664",["sidebar-chat-rail-base-" + chat.id,m.chatHeight,colors.outlineVariant.copy({ alpha: 0.45 })],__operitUiTemplate_25664),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:25860",["sidebar-chat-rail-indicator-" + chat.id,selected ? 2 : 1,selected ? 16 : 0,indicatorColor,selected ? 16 : 10,selected ? colors.primary : colors.onSurface.copy({ alpha: 0.55 })],__operitUiTemplate_25860)],__operitUiTemplate_25506);
    return OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:26364",["sidebar-chat-drop-" + chat.id,dragType(section),chat.id,colors.primary.copy({ alpha: 0.55 }),(id2) => actions.drop(String(id2), section.id, groupId, chat.id),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:26737",["sidebar-chat-hover-" + chat.id,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:26835",["sidebar-chat-" + chat.id,m.chatHeight,m.chatStart + depth * 16,m.chatEnd,rail,gap(2),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:27130",[colors.onSurfaceVariant.copy({ alpha: 0.07 }),m.chatRadius,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:27292",["sidebar-chat-swipe-" + chat.id,ctx.Modifier.clip({ cornerRadius: m.chatRadius }),() => actions.rename(chat.id),() => actions.confirmSwipeDelete(chat.id),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:27664",[colors.primary,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:27804",[m.swipeIconSize,m.swipeIconSize,m.swipeIconSize,colors.onPrimary],__operitUiTemplate_27804)],__operitUiTemplate_27664),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:27976",[colors.error,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:28110",[m.swipeIconSize,m.swipeIconSize,m.swipeIconSize,colors.onError],__operitUiTemplate_28110)],__operitUiTemplate_27976),surface],__operitUiTemplate_27292)],__operitUiTemplate_27130)],__operitUiTemplate_26835)],__operitUiTemplate_26737)],__operitUiTemplate_26364);
  }
  function chats(values, id2, section, groupId, matchAll = false) {
    const matches = values.filter((chat) => tree.roots.has(chat.id) && (matchAll || matching.has(chat.id)));
    const expanded = state.expandedGroups.includes("preview:" + id2);
    const preview = query !== "" || expanded ? matches : matches.filter((chat, index) => index < m.previewLimit || chat.pinned || current.chatSidebar.currentChatId === chat.id || current.chatSidebar.activeStreamingChatIds.includes(chat.id));
    const result = [];
    function append(chat, depth) {
      result.push(() => chatRow(chat, section, groupId, depth));
      if (query !== "" || state.expandedGroups.includes("children:" + chat.id)) {
        for (const child of tree.children.get(chat.id)) {
          if (matchAll || matching.has(child.id)) append(child, depth + 1);
        }
      }
    }
    for (const chat of preview) append(chat, 0);
    const hidden = matches.length - preview.length;
    if (query === "" && (hidden > 0 || expanded && matches.length > m.previewLimit)) result.push(() => OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:29374",["sidebar-preview-" + id2,m.chatStart,m.chatEnd,() => actions.toggleGroup("preview:" + id2),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:29678",[expanded ? "ExpandLess" : "ExpandMore",colors.onSurfaceVariant.copy({ alpha: 0.72 })],__operitUiTemplate_29678),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:29810",[expanded ? "\u6536\u8D77" : "\u5C55\u5F00\u66F4\u591A " + hidden,colors.onSurfaceVariant.copy({ alpha: 0.72 })],__operitUiTemplate_29810)],__operitUiTemplate_29374));
    return result;
  }
  function category(section) {
    const collapsed = state.collapsed.includes(section.id);
    const avatar = section.kind === "card" ? OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:30161",["sidebar-avatar-" + section.id,section.avatarUri ?? defaultAvatar ?? "",m.categoryAvatar,m.categoryAvatar,section.title,ctx.Modifier.clip({ type: "circle" })],__operitUiTemplate_30161) : OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:30467",[m.categoryAvatar,m.categoryAvatar,colors.surfaceContainerLow.copy({ alpha: 0.72 }),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:30719",[section.kind === "group" ? "Groups" : "AccountTree",colors.onSurfaceVariant],__operitUiTemplate_30719)],__operitUiTemplate_30467);
    return OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:30853",["sidebar-section-" + section.id,m.categoryStart,m.categoryEnd,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:31087",["sidebar-category-drop-" + section.id,dragType(section),(id2) => actions.drop(String(id2), section.id, null),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:31306",[() => actions.toggleSection(section.id),ctx.Modifier.clip({ cornerRadius: m.categoryRadius }),avatar,gap(8),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:31603",[section.title,ctx.Modifier.widthIn({ max: 170 }),colors.onSurface],__operitUiTemplate_31603),gap(8),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:31909",[String(section.chats.length),colors.onSurfaceVariant.copy({ alpha: 0.64 })],__operitUiTemplate_31909),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:32066",[colors.outlineVariant.copy({ alpha: 0.62 }),colors.outlineVariant.copy({ alpha: 0 })],__operitUiTemplate_32066),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:32255",[collapsed ? "KeyboardArrowDown" : "KeyboardArrowUp",colors.onSurfaceVariant.copy({ alpha: 0.78 })],__operitUiTemplate_32255)],__operitUiTemplate_31306)],__operitUiTemplate_31087)],__operitUiTemplate_30853);
  }
  function groupRow(group, section, ungrouped = false) {
    const expanded = !state.collapsed.includes("group:" + group.id);
    const groupBody = OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:32571",[{
      fillMaxWidth: true,
      verticalAlignment: "center",
      paddingStart: 12,
      paddingEnd: 8,
      paddingTop: 2,
      paddingBottom: 2,
      ...{ background: colors.surfaceContainerLow.copy({ alpha: 0.72 }), backgroundShape: { cornerRadius: m.groupRadius }, modifier: ctx.Modifier.border(1, colors.outlineVariant.copy({ alpha: 0.24 }), { cornerRadius: m.groupRadius }) },
      onClick: () => actions.toggleSection("group:" + group.id)
    },[
      OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:33051",[colors.onSurfaceVariant.copy({ alpha: 0.76 })],__operitUiTemplate_33051),
      gap(7),
      OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:33175",[group.name,colors.onSurface.copy({ alpha: 1 })],__operitUiTemplate_33175),
      ...group.pinned ? [gap(4), OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:33373",[colors.onSurfaceVariant.copy({ alpha: 0.65 })],__operitUiTemplate_33373)] : [],
      gap(2),
      ungrouped ? OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:33515",[actions.menu("ungrouped", section.id)],__operitUiTemplate_33515) : more("group", group.id),
      gap(2),
      OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:33645",[expanded ? "KeyboardArrowUp" : "KeyboardArrowDown",colors.onSurfaceVariant.copy({ alpha: 0.62 })],__operitUiTemplate_33645)
    ]],__operitUiTemplate_32571);
    return OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:33801",["sidebar-group-" + group.id,m.groupStart,m.groupEnd,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:34025",["sidebar-group-drop-" + group.id,dragType(section),colors.primary.copy({ alpha: 0.55 }),m.groupRadius,(id2) => actions.drop(String(id2), section.id, ungrouped ? null : group.id),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:34378",[m.groupRadius,groupBody],__operitUiTemplate_34378)],__operitUiTemplate_34025)],__operitUiTemplate_33801);
  }
  const sections = state.data.view === "characters" ? state.data.sections : state.data.scopes.map((scope) => ({
    id: scope.id,
    title: scope.title,
    kind: scope.kind ?? "unbound",
    selection: scope.ownerSelection,
    avatarUri: scope.avatarUri ?? null,
    chats: [...scope.ungrouped, ...scope.groups.flatMap((group) => group.chats)],
    conversationGroups: scope.groups,
    ungroupedChats: scope.ungrouped
  }));
  for (const section of sections) {
    const groups = (section.conversationGroups ?? []).filter((group) => group.chats.length === 0 || group.chats.some((chat) => tree.roots.has(chat.id)));
    const ungrouped = (section.ungroupedChats ?? section.chats).filter((chat) => tree.roots.has(chat.id));
    if (ungrouped.length === 0 && groups.length === 0) continue;
    const categoryMatches = query === "" || section.title.toLocaleLowerCase().includes(query);
    const visibleGroups = groups.filter((group) => categoryMatches || group.name.toLocaleLowerCase().includes(query) || group.chats.some((chat) => tree.roots.has(chat.id) && matching.has(chat.id)));
    if (!categoryMatches && visibleGroups.length === 0 && !ungrouped.some((chat) => matching.has(chat.id))) continue;
    rows.push(() => category(section));
    if (state.collapsed.includes(section.id)) continue;
    for (const group of visibleGroups) {
      rows.push(() => groupRow(group, section));
      if (!state.collapsed.includes("group:" + group.id)) rows.push(...chats(group.chats, group.id, section, group.id, categoryMatches || group.name.toLocaleLowerCase().includes(query)));
    }
    if (ungrouped.length > 0 && (categoryMatches || "\u672A\u5206\u7EC4".includes(query) || ungrouped.some((chat) => matching.has(chat.id)))) {
      const id2 = "ungrouped:" + section.id;
      rows.push(() => groupRow({ id: id2, name: "\u672A\u5206\u7EC4", pinned: ungrouped.every((chat) => chat.pinned), displayOrder: 0, chats: ungrouped }, section, true));
      if (!state.collapsed.includes("group:" + id2)) rows.push(...chats(ungrouped, id2, section, null, categoryMatches || "\u672A\u5206\u7EC4".includes(query)));
    }
  }
  if (rows.length === 0) rows.push(() => OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:36628",[query === "" ? "\u6682\u65E0\u4F1A\u8BDD" : "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD",m.chatHeight,muted],__operitUiTemplate_36628));
  return rows;
}
function nativeSidebarRows(ctx, current, state, actions, defaultAvatar) {
  return sidebarRowBuilders(ctx, current, state, actions, defaultAvatar).map((build) => build());
}

// src/sidebar-group-delete.ts
function deleteConversationGroupMembers(chatIds, deleteChat) {
  return __async(this, null, function* () {
    if (new Set(chatIds).size !== chatIds.length) throw new Error("Duplicate confirmed folder members");
    const progress = { deletedChatIds: [], failedChatIds: [] };
    for (const chatId of chatIds) {
      try {
        const result = yield deleteChat(chatId);
        if (result.chatId !== chatId || !Number.isFinite(result.deletedAt)) throw new Error("Native deletion did not confirm requested chat: " + chatId);
        progress.deletedChatIds.push(chatId);
      } catch (error) {
        progress.failedChatIds.push({ chatId, error: String(error) });
      }
    }
    return progress;
  });
}

// src/ui-sidebar-native.ts
function renderSidebarScreen(ctx) {
  const [input] = ctx.useState("input", null);
  const [chatSidebar] = ctx.useState("chatSidebar", null);
  const [capabilities] = ctx.useState("chatSidebarCapabilities", null);
  const parsed = ctx.useMemo("native-sidebar-inputs", () => parseCurrentSidebar({ input, chatSidebar }), [input, chatSidebar]);
  const current = ctx.useRef("native-sidebar-current", parsed);
  current.current = parsed;
  const catalogKey = sidebarCatalogKey;
  const [warmData] = ctx.useState("chatSidebarPrepared", null);
  const prepared = preparedSidebar(warmData, current.current);
  const identity2 = catalogKey(current.current), colors = ctx.MaterialTheme.colorScheme;
  const [state, setState] = ctx.useState("native-sidebar-state", {
    data: prepared?.data ?? null,
    defaultAvatar: prepared?.defaultAvatar ?? null,
    context: prepared?.context ?? "",
    loading: prepared === null,
    busy: false,
    error: "",
    query: "",
    search: false,
    collapsed: [],
    expandedGroups: [],
    dialog: null
  });
  const latest = ctx.useRef("native-sidebar-state-ref", state);
  latest.current = state;
  const pending = ctx.useRef("native-sidebar-pending", null);
  const avatarResource = ctx.useRef("native-sidebar-avatar-resource", null);
  function update(change) {
    const previous = latest.current;
    const keys = Object.keys(change);
    if (keys.every((key) => Object.is(previous[key], change[key]))) return;
    const next = { ...previous, ...change };
    latest.current = next;
    setState(next);
  }
  function assertCurrent() {
    if (catalogKey(current.current) !== identity2) throw new Error("The sidebar context changed; refresh before using this action");
  }
  function refresh() {
    return __async(this, null, function* () {
      const request = current.current, key = catalogKey(request);
      const active = pending.current;
      if (active?.key === key && typeof active.promise?.then === "function") return active.promise;
      const promise = load();
      pending.current = { key, promise };
      try {
        yield promise;
      } finally {
        if (pending.current?.promise === promise) pending.current = null;
      }
      function load() {
        return __async(this, null, function* () {
          update({ loading: latest.current.data === null || latest.current.data.view !== request.input.view, error: "" });
          try {
            const data2 = yield ToolPkg.ipc.call("character-sidebar.catalog", request, { targetRuntime: "main" });
            if (catalogKey(current.current) === key) {
              if (data2.view !== request.input.view) throw new Error("The sidebar catalog belongs to another view");
              update({ data: data2, context: key, loading: false });
              if ((data2.view === "characters" ? data2.sections : data2.scopes).some((section) => section.kind === "card" && section.avatarUri === null) && latest.current.defaultAvatar === null) {
                const resource = avatarResource.current ?? ToolPkg.readResource("character_default_avatar", "operit-avatar.png");
                avatarResource.current = resource;
                void resource.then((path) => {
                  if (path.trim() === "") throw new Error("Declared default avatar resource is missing");
                  if (catalogKey(current.current) === key) update({ defaultAvatar: path });
                }).catch(() => {
                  if (avatarResource.current === resource) avatarResource.current = null;
                });
              }
            }
          } catch (failure) {
            if (catalogKey(current.current) === key) update({ loading: false, context: key, error: String(failure) });
          }
        });
      }
    });
  }
  function refreshInputs() {
    return __async(this, null, function* () {
      if (latest.current.data !== null && latest.current.error === "" && latest.current.context === catalogKey(current.current)) return;
      yield refresh();
    });
  }
  function run(action) {
    return __async(this, null, function* () {
      assertCurrent();
      if (latest.current.busy) throw new Error("A sidebar operation is already running");
      update({ busy: true, error: "" });
      try {
        return yield action();
      } catch (failure) {
        update({ error: String(failure) });
        return null;
      } finally {
        update({ busy: false });
      }
    });
  }
  function activate2(chatId) {
    assertCurrent();
    if (!current.current.chatSidebar.chats.some((chat) => chat.id === chatId)) throw new Error("The conversation is absent from the supplied sidebar history");
    return { type: "toolpkg.chat.activate", chatId };
  }
  function scopeFor(id2) {
    const data2 = visibleCatalog();
    if (data2 === null) throw new Error("Conversation groups are not loaded");
    const scopes = data2.view !== "characters" ? data2.scopes : data2.sections.map((section) => ({
      id: section.id,
      title: section.title,
      ownerSelection: section.selection,
      groups: section.conversationGroups ?? [],
      ungrouped: section.ungroupedChats ?? section.chats
    }));
    const scope = scopes.find((owner2) => owner2.id === id2 || owner2.groups.some((group) => group.id === id2));
    if (scope === void 0) throw new Error("The conversation-group scope no longer exists");
    return scope;
  }
  function readGroup(id2) {
    const group = scopeFor(id2).groups.find((group2) => group2.id === id2);
    if (group === void 0) throw new Error("The native folder no longer exists");
    return group;
  }
  function createChat(selection, groupId) {
    return __async(this, null, function* () {
      assertCurrent();
      if (latest.current.busy) return null;
      update({ busy: true, error: "" });
      try {
        const created = yield Tools.Chat.createNew({ setAsCurrentChat: false, input: selection === "" ? null : createChatInput(selection) });
        yield Tools.Chat.updateGroup([created.chatId], groupId === null ? null : readGroup(groupId).name);
        return { type: "toolpkg.chat.activate", chatId: created.chatId };
      } catch (failure) {
        update({ error: String(failure) });
        return null;
      } finally {
        update({ busy: false });
      }
    });
  }
  function dialog(kind, id2, name = "") {
    assertCurrent();
    update({ dialog: { kind, id: id2, name, progress: null } });
  }
  function submit() {
    return __async(this, null, function* () {
      const staged = latest.current.dialog;
      if (staged === null) throw new Error("No sidebar dialog is open");
      switch (staged.kind) {
        case "chatActions":
          throw new Error("Choose a conversation action");
        case "renameChat":
          yield Tools.Chat.updateTitle(staged.id, staged.name);
          break;
        case "deleteChat":
          yield Tools.Chat.deleteChat(staged.id);
          break;
        case "create": {
          const name = staged.name.trim();
          if (name === "") throw new Error("\u5206\u7EC4\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
          const selection = scopeFor(staged.id).ownerSelection;
          const created = yield Tools.Chat.createNew({ setAsCurrentChat: false, input: selection === null ? null : createChatInput(selection) });
          yield Tools.Chat.updateGroup([created.chatId], name);
          update({ dialog: null });
          yield refresh();
          return { type: "toolpkg.chat.activate", chatId: created.chatId };
        }
        case "renameUngrouped": {
          yield Tools.Chat.updateGroup(scopeFor(staged.id).ungrouped.map((chat) => chat.id), staged.name.trim());
          break;
        }
        case "deleteUngrouped": {
          const progress = { deletedChatIds: [], failedChatIds: [] };
          for (const chat of scopeFor(staged.id).ungrouped) {
            try {
              yield Tools.Chat.deleteChat(chat.id);
              progress.deletedChatIds.push(chat.id);
            } catch (error) {
              progress.failedChatIds.push({ chatId: chat.id, error: String(error) });
            }
          }
          update({ dialog: { ...staged, progress } });
          yield refresh();
          return null;
        }
        case "rename":
          yield Tools.Chat.updateGroup(readGroup(staged.id).chats.map((chat) => chat.id), staged.name.trim());
          break;
        case "delete": {
          if (staged.progress !== null) throw new Error("This confirmed deletion has already been attempted");
          const group = readGroup(staged.id);
          const progress = yield deleteConversationGroupMembers(group.chats.map((chat) => chat.id), (id2) => Tools.Chat.deleteChat(id2));
          update({ dialog: { ...staged, progress } });
          yield refresh();
          return null;
        }
      }
      update({ dialog: null });
      yield refresh();
      return null;
    });
  }
  function chatFor(id2) {
    const chat = current.current.chatSidebar.chats.find((value) => value.id === id2);
    if (chat === void 0) throw new Error("The conversation no longer exists");
    return chat;
  }
  function renameChat(id2) {
    dialog("renameChat", id2, chatFor(id2).title);
  }
  function confirmSwipeDelete(id2) {
    dialog("deleteChat", id2, chatFor(id2).title);
  }
  function deleteChat(id2) {
    return __async(this, null, function* () {
      yield run(() => __async(null, null, function* () {
        chatFor(id2);
        yield Tools.Chat.deleteChat(id2);
        update({ dialog: null });
        yield refresh();
      }));
    });
  }
  function longPress(id2) {
    dialog("chatActions", id2, chatFor(id2).title);
  }
  function openInWindow(id2) {
    assertCurrent();
    chatFor(id2);
    if (capabilities?.openInWindow !== true) throw new Error("Detached chat windows are not available");
    update({ dialog: null });
    return { type: "toolpkg.chat.openInWindow", chatId: id2 };
  }
  function changeFlag(id2, pinned) {
    return __async(this, null, function* () {
      yield run(() => __async(null, null, function* () {
        const chat = chatFor(id2);
        if (pinned) yield Tools.Chat.updatePinned(id2, !chat.pinned);
        else yield Tools.Chat.updateLocked(id2, !chat.locked);
        update({ dialog: null });
        yield refresh();
      }));
    });
  }
  function reorder(chatId, targetId) {
    return __async(this, null, function* () {
      const ids = current.current.chatSidebar.chats.map((chat) => chat.id);
      const from = ids.indexOf(chatId), to = ids.indexOf(targetId);
      if (from < 0 || to < 0) throw new Error("The reordered conversation no longer exists");
      if (from === to) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      yield Tools.Chat.reorder(ids);
    });
  }
  function orderNeighbours(id2) {
    const data2 = visibleCatalog();
    if (data2 === null) return [];
    const scopes = data2.view !== "characters" ? data2.scopes : data2.sections.map((section) => ({ groups: section.conversationGroups ?? [], ungrouped: section.ungroupedChats ?? section.chats }));
    for (const scope of scopes) {
      const values = scope.groups.find((group) => group.chats.some((chat) => chat.id === id2))?.chats ?? scope.ungrouped;
      if (values.some((chat) => chat.id === id2)) return values.map((chat) => chat.id);
    }
    return [];
  }
  function moveRelative(id2, delta) {
    return __async(this, null, function* () {
      const ids = orderNeighbours(id2), index = ids.indexOf(id2), target = ids[index + delta];
      if (index < 0 || target === void 0) return;
      yield run(() => __async(null, null, function* () {
        yield reorder(id2, target);
        update({ dialog: null });
        yield refresh();
      }));
    });
  }
  function menu(kind, id2) {
    if (kind === "chat") {
      const chat = chatFor(id2);
      return OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:49617",["sidebar-chat-menu-" + id2,!state.busy,chat.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876",chat.locked ? "\u89E3\u9501" : "\u9501\u5B9A",chat.locked ? "LockOpen" : "Lock",(index) => __async(null, null, function* () {
          if (index === 0) renameChat(id2);
          else if (index === 1) yield changeFlag(id2, true);
          else if (index === 2) yield changeFlag(id2, false);
          else if (index === 3) yield deleteChat(id2);
        }),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:50469",[colors.onSurfaceVariant.copy({ alpha: 0.78 })],__operitUiTemplate_50469)],__operitUiTemplate_49617);
    }
    if (kind === "ungrouped") {
      const scope = scopeFor(id2);
      const pinned = scope.ungrouped.length > 0 && scope.ungrouped.every((chat) => chat.pinned);
      return OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:50752",["sidebar-ungrouped-menu-" + id2,!state.busy && state.data !== null,pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876",pinned ? "PushPinOutlined" : "PushPinRounded",(index) => __async(null, null, function* () {
          if (index === 0) return createChat(scope.ownerSelection ?? "", null);
          if (index === 1) dialog("renameUngrouped", id2, "\u672A\u5206\u7EC4");
          if (index === 2) yield run(() => __async(null, null, function* () {
            for (const chat of scope.ungrouped) yield Tools.Chat.updatePinned(chat.id, !pinned);
            yield refresh();
          }));
          if (index === 3) dialog("deleteUngrouped", id2, "\u672A\u5206\u7EC4");
          return null;
        }),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:51956",[colors.onSurfaceVariant.copy({ alpha: 0.78 })],__operitUiTemplate_51956)],__operitUiTemplate_50752);
    }
    const group = scopeFor(id2).groups.find((value) => value.id === id2);
    const items = [
      { label: "\u65B0\u5EFA\u5BF9\u8BDD", icon: "AddCommentOutlined" },
      { label: "\u7F16\u8F91\u540D\u79F0", icon: "EditOutlined" },
      { label: group.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876", icon: group.pinned ? "PushPinOutlined" : "PushPinRounded" },
      { label: "\u5220\u9664", icon: "DeleteOutlineRounded", danger: true, dividerBefore: true }
    ];
    return OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:52554",["sidebar-group-menu-" + id2,items,!state.busy,(index) => __async(null, null, function* () {
        if (index === 0) {
          const owner2 = scopeFor(id2).ownerSelection;
          return createChat(owner2 ?? "", id2);
        } else if (index === 1) dialog("rename", id2, group.name);
        else if (index === 2) yield run(() => __async(null, null, function* () {
          for (const chat of group.chats) yield Tools.Chat.updatePinned(chat.id, !group.pinned);
          yield refresh();
        }));
        else if (index === 3) dialog("delete", id2, group.name);
        return null;
      }),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:53338",[colors.onSurfaceVariant.copy({ alpha: 0.78 })],__operitUiTemplate_53338)],__operitUiTemplate_52554);
  }
  function drop(chatId, scopeId, groupId, targetId) {
    return __async(this, null, function* () {
      assertCurrent();
      if (latest.current.busy) throw new Error("A sidebar operation is already running");
      const scope = scopeFor(scopeId);
      if (!scope.ungrouped.some((chat) => chat.id === chatId) && !scope.groups.some((group) => group.chats.some((chat) => chat.id === chatId)))
        throw new Error("The conversation no longer belongs to the target scope");
      if (groupId !== null && !scope.groups.some((group) => group.id === groupId))
        throw new Error("The target conversation group no longer exists");
      const existing = scope.groups.find((group) => group.chats.some((chat) => chat.id === chatId))?.id ?? null;
      if (existing === groupId && targetId === void 0) return;
      update({ busy: true, error: "" });
      try {
        if (existing !== groupId) yield Tools.Chat.updateGroup([chatId], groupId === null ? null : readGroup(groupId).name);
        if (targetId !== void 0) yield reorder(chatId, targetId);
        yield refresh();
      } catch (failure) {
        update({ error: String(failure) });
        throw failure;
      } finally {
        update({ busy: false });
      }
    });
  }
  function visibleCatalog() {
    const data2 = latest.current.data;
    return data2 === null || data2.view !== current.current.input.view ? null : latest.current.context === catalogKey(current.current) ? data2 : reconcileSidebarCatalog(data2, current.current);
  }
  const data = visibleCatalog();
  const toggleSection = (id2) => update({ collapsed: state.collapsed.includes(id2) ? state.collapsed.filter((key) => key !== id2) : [...state.collapsed, id2] });
  const toggleGroup = (id2) => update({ expandedGroups: state.expandedGroups.includes(id2) ? state.expandedGroups.filter((key) => key !== id2) : [...state.expandedGroups, id2] });
  const searchActive = state.search || state.query.trim() !== "";
  const rows = [OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:55419",[OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:55607",[colors.primaryContainer,colors.onPrimaryContainer,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:55850",[OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:55923",[() => __async(null, null, function* () {
            const active = yield callMainDomain("activePrompt.get", {});
            return createChat(encodeSelection(active), null);
          }),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:56349",[colors.onPrimaryContainer],__operitUiTemplate_56349),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:56439",[{ text: "\u65B0\u5EFA\u5BF9\u8BDD", fontSize: 13, fontWeight: "600", color: colors.onPrimaryContainer, ...{ letterSpacing: -0.1 } }],__operitUiTemplate_56439)],__operitUiTemplate_55923),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:56604",[colors.onPrimaryContainer.copy({ alpha: 0.16 })],__operitUiTemplate_56604),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:56711",[() => __async(null, null, function* () {
            const active = yield callMainDomain("activePrompt.get", {});
            const selection = encodeSelection(active);
            const catalog = visibleCatalog();
            if (catalog === null) throw new Error("Sidebar has not loaded");
            const scope = catalog.view === "characters" ? catalog.sections.find((section) => section.selection === selection) : catalog.scopes.find((scope2) => scope2.ownerSelection === selection);
            if (scope === void 0) throw new Error("The active owner is absent from the actual sidebar catalog");
            dialog("create", scope.id);
          }),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:57571",[colors.onPrimaryContainer],__operitUiTemplate_57571)],__operitUiTemplate_56711)],__operitUiTemplate_55850)],__operitUiTemplate_55607),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:57732",[() => update({ search: !state.search }),ctx.Modifier.clip({ cornerRadius: 6 }),searchActive ? colors.secondaryContainer.copy({ alpha: 0.35 }) : colors.surface.copy({ alpha: 0 }),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:58157",[state.search ? "SearchOffRounded" : "SearchRounded",searchActive ? colors.primary : colors.onSurfaceVariant.copy({ alpha: 0.78 }),state.search ? "\u6536\u8D77\u641C\u7D22" : "\u641C\u7D22\u5BF9\u8BDD"],__operitUiTemplate_58157)],__operitUiTemplate_57732)],__operitUiTemplate_55419)];
  rows.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:58444",[state.search ? OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:58643",[OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:58736",[state.query,(query) => update({ query }),colors.onSurface,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:59035",[colors.onSurfaceVariant.copy({ alpha: 0.72 })],__operitUiTemplate_59035),colors.surfaceContainerLow.copy({ alpha: 0.72 }),colors.primary,colors.onSurfaceVariant.copy({ alpha: 0.62 })],__operitUiTemplate_58736)],__operitUiTemplate_58643) : OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:59512",null,__operitUiTemplate_59512)],__operitUiTemplate_58444));
  if (state.error !== "") rows.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:59583",[state.error,colors.error],__operitUiTemplate_59583));
  if (data !== null) {
    const actions = {
      activate: activate2,
      toggleSection,
      toggleGroup,
      menu,
      longPress,
      rename: renameChat,
      confirmSwipeDelete,
      drop
    };
    const layoutActions = ctx.useRef("native-sidebar-layout-actions", actions);
    Object.assign(layoutActions.current, actions);
    rows.push(...nativeSidebarRows(
      ctx,
      current.current,
      {
        data,
        query: state.query,
        collapsed: state.collapsed,
        expandedGroups: state.expandedGroups,
        busy: state.busy
      },
      layoutActions.current,
      state.defaultAvatar
    ));
  } else if (state.loading) rows.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:60399",[OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:60483",null,__operitUiTemplate_60483)],__operitUiTemplate_60399));
  const content = [...rows];
  if (state.dialog !== null) {
    const staged = state.dialog, body = [OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:60628",[{ create: "\u65B0\u5EFA\u5206\u7EC4", rename: "\u91CD\u547D\u540D\u5206\u7EC4", delete: "\u5220\u9664\u5206\u7EC4\u53CA\u5176\u5BF9\u8BDD", renameUngrouped: "\u91CD\u547D\u540D\u5206\u7EC4", deleteUngrouped: "\u5220\u9664\u5206\u7EC4\u53CA\u5176\u5BF9\u8BDD", renameChat: "\u7F16\u8F91\u5BF9\u8BDD\u540D\u79F0", deleteChat: "\u5220\u9664\u5BF9\u8BDD", chatActions: "\u804A\u5929\u8BB0\u5F55" }[staged.kind]],__operitUiTemplate_60628)];
    if (staged.kind === "create" || staged.kind === "rename" || staged.kind === "renameUngrouped" || staged.kind === "renameChat") body.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:61234",[staged.name,staged.kind === "renameChat" ? "\u5BF9\u8BDD\u540D\u79F0" : "\u5206\u7EC4\u540D\u79F0",(name) => update({ dialog: { ...staged, name } }),!state.busy],__operitUiTemplate_61234));
    if (staged.kind === "delete" || staged.kind === "deleteUngrouped" || staged.kind === "deleteChat") body.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:61600",[staged.kind === "deleteChat" ? `\u786E\u8BA4\u5220\u9664\u5BF9\u8BDD\u201C${staged.name}\u201D\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002` : `\u786E\u8BA4\u5220\u9664\u201C${staged.name}\u201D\u53CA\u5176\u4E2D\u7684\u5168\u90E8\u5BF9\u8BDD\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`],__operitUiTemplate_61600));
    if (staged.kind === "chatActions") {
      const chat = chatFor(staged.id), ids = orderNeighbours(staged.id), index = ids.indexOf(staged.id);
      body.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:62108",[chat.title,colors.onSurfaceVariant],__operitUiTemplate_62108));
      const tile = (label, icon, callback, enabled = true, danger = false) => OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:62309",[enabled ? callback : void 0,colors.surface,OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:62455",[OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:62588",[icon,danger ? colors.error : colors.onSurfaceVariant],__operitUiTemplate_62588),OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:62692",[label,danger ? colors.error : colors.onSurface],__operitUiTemplate_62692)],__operitUiTemplate_62455)],__operitUiTemplate_62309);
      if (capabilities?.openInWindow === true) body.push(tile("\u5728\u65B0\u7A97\u53E3\u6253\u5F00", "OpenInNew", () => openInWindow(chat.id)));
      body.push(
        tile("\u7F16\u8F91\u540D\u79F0", "Edit", () => renameChat(chat.id)),
        tile("\u4E0A\u79FB", "KeyboardArrowUp", () => moveRelative(chat.id, -1), index > 0),
        tile("\u4E0B\u79FB", "KeyboardArrowDown", () => moveRelative(chat.id, 1), index >= 0 && index < ids.length - 1),
        tile(chat.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876", "PushPin", () => changeFlag(chat.id, true)),
        tile(chat.locked ? "\u89E3\u9501" : "\u9501\u5B9A", chat.locked ? "LockOpen" : "Lock", () => changeFlag(chat.id, false)),
        tile("\u5220\u9664", "DeleteOutline", () => deleteChat(chat.id), true, true)
      );
    }
    if (staged.progress !== null) body.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:63660",[`\u5DF2\u5220\u9664 ${staged.progress.deletedChatIds.length} \u6761\u5BF9\u8BDD
` + staged.progress.failedChatIds.map((value) => value.chatId + ": " + value.error).join("\n"),staged.progress.failedChatIds.length === 0 ? colors.onSurface : colors.error],__operitUiTemplate_63660));
    if (state.error !== "") body.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:64027",[state.error,colors.error],__operitUiTemplate_64027));
    body.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:64113",[[
      OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:64148",[!state.busy,() => update({ dialog: null })],__operitUiTemplate_64148),
      ...staged.progress === null && staged.kind !== "chatActions" ? [OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:64326",[!state.busy,() => run(submit)],__operitUiTemplate_64326)] : []
    ]],__operitUiTemplate_64113));
    content.push(OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:64448",[!state.busy,() => {
      if (!state.busy) update({ dialog: null });
    },OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:64612",[body],__operitUiTemplate_64612)],__operitUiTemplate_64448));
  }
  const onLoad = prepared === null ? refresh : () => {
    void Promise.resolve().then(refresh).catch(() => {
    });
  };
  return OperitComposeGeneration.template(ctx,"com.operit.character_cards:dist/ui/chat-sidebar/index.ui.js:64813",[onLoad,refreshInputs,content],__operitUiTemplate_64813);
}

// src/ui-sidebar.ts
function sidebarCatalogKey(value) {
  return JSON.stringify({ input: value.input, chats: value.chatSidebar.chats });
}
function preparedSidebar(value, current) {
  if (value === null || value === void 0) return null;
  const prepared = exactFields(value, ["context", "data", "defaultAvatar"], "prepared sidebar");
  if (prepared.context !== sidebarCatalogKey(current)) return null;
  const data = record(prepared.data, "prepared sidebar data");
  if (data.view !== current.input.view) return null;
  const sections = data.view === "characters" ? data.sections : data.scopes;
  if (!Array.isArray(sections)) throw new Error("Prepared sidebar must contain sections or scopes");
  if (prepared.defaultAvatar !== null && typeof prepared.defaultAvatar !== "string") throw new Error("Prepared default avatar must be text or null");
  return { context: prepared.context, data: prepared.data, defaultAvatar: prepared.defaultAvatar };
}
function exactFields(value, expected, label) {
  const object = record(value, label), keys = Object.keys(object);
  if (keys.length !== expected.length || keys.some(
    /** Rejects every field not explicitly declared by this boundary. */
    (key) => expected.indexOf(key) === -1
  )) throw new Error(label + " has invalid fields");
  return object;
}
function sidebarIdentity(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(label + " must be a nonblank string");
  return value;
}
function parseSidebarInput(value) {
  const input = exactFields(value, ["view"], "sidebar input");
  if (input.view !== "characters" && input.view !== "groups") throw new Error("sidebar input.view must be characters or groups");
  return { view: input.view };
}
function parseSidebarChat(value) {
  const chat = exactFields(value, ["id", "title", "updatedAt", "displayOrder", "workspaceId", "workspaceName", "locked", "pinned", "group", "parentChatId"], "sidebar chat");
  if (chat.group !== null && typeof chat.group !== "string") throw new Error("sidebar chat.group must be a string or null");
  if (chat.parentChatId !== null) sidebarIdentity(chat.parentChatId, "sidebar chat.parentChatId");
  const id2 = sidebarIdentity(chat.id, "sidebar chat.id");
  if (typeof chat.title !== "string" || typeof chat.updatedAt !== "string") throw new Error("sidebar chat title and updatedAt must be strings");
  if (typeof chat.displayOrder !== "number" || !Number.isSafeInteger(chat.displayOrder)) throw new Error("sidebar chat.displayOrder must be a safe integer");
  if (chat.workspaceId !== null && typeof chat.workspaceId !== "string") throw new Error("sidebar chat.workspaceId must be a string or null");
  if (chat.workspaceName !== null && typeof chat.workspaceName !== "string") throw new Error("sidebar chat.workspaceName must be a string or null");
  if (typeof chat.locked !== "boolean" || typeof chat.pinned !== "boolean") throw new Error("sidebar chat locked and pinned must be booleans");
  return { id: id2, title: chat.title, updatedAt: chat.updatedAt, displayOrder: chat.displayOrder, workspaceId: chat.workspaceId, workspaceName: chat.workspaceName, locked: chat.locked, pinned: chat.pinned, group: chat.group, parentChatId: chat.parentChatId };
}
function parseChatSidebarContext(value) {
  const context = exactFields(value, ["chats", "currentChatId", "activeStreamingChatIds"], "chatSidebar");
  if (!Array.isArray(context.chats)) throw new Error("chatSidebar.chats must be an array");
  if (!Array.isArray(context.activeStreamingChatIds)) throw new Error("chatSidebar.activeStreamingChatIds must be an array");
  const chats = [], ids = /* @__PURE__ */ new Set(), streaming = /* @__PURE__ */ new Set();
  for (const raw of context.chats) {
    const chat = parseSidebarChat(raw);
    if (ids.has(chat.id)) throw new Error("Duplicate sidebar chat: " + chat.id);
    ids.add(chat.id);
    chats.push(chat);
  }
  for (const raw of context.activeStreamingChatIds) {
    const id2 = sidebarIdentity(raw, "activeStreamingChatIds entry");
    if (streaming.has(id2)) throw new Error("Duplicate active streaming chat: " + id2);
    streaming.add(id2);
  }
  const currentChatId = context.currentChatId === null ? null : sidebarIdentity(context.currentChatId, "chatSidebar.currentChatId");
  return { chats, currentChatId, activeStreamingChatIds: [...streaming] };
}
function parseCurrentSidebar(value) {
  const current = exactFields(value, ["input", "chatSidebar"], "current sidebar");
  return { input: parseSidebarInput(current.input), chatSidebar: parseChatSidebarContext(current.chatSidebar) };
}
function compareSidebarChats(left, right) {
  return Number(right.pinned) - Number(left.pinned) || left.displayOrder - right.displayOrder || left.id.localeCompare(right.id);
}
function conversationSidebarScope(section) {
  const byName = /* @__PURE__ */ new Map(), ungrouped = [];
  for (const chat of section.chats) {
    const name = chat.group?.trim();
    if (!name) {
      ungrouped.push(chat);
      continue;
    }
    const members = byName.get(name) ?? [];
    members.push(chat);
    byName.set(name, members);
  }
  const groups = [...byName].map(([name, chats]) => ({
    id: section.id + ":folder:" + JSON.stringify(name),
    name,
    pinned: chats.length > 0 && chats.every((chat) => chat.pinned),
    displayOrder: Math.min(...chats.map((chat) => chat.displayOrder)),
    chats: chats.sort(compareSidebarChats)
  }));
  groups.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  return {
    id: section.id,
    title: section.title,
    ownerSelection: section.selection,
    avatarUri: section.avatarUri,
    kind: section.kind,
    groups,
    ungrouped: ungrouped.sort(compareSidebarChats)
  };
}
function reconcileSidebarCatalog(catalog, current) {
  const live = new Map(current.chatSidebar.chats.map((chat) => [chat.id, chat]));
  const sections = catalog.view === "characters" ? catalog.sections : catalog.scopes.map((scope) => ({
    id: scope.id,
    title: scope.title,
    kind: scope.kind ?? "unbound",
    selection: scope.ownerSelection,
    avatarUri: scope.avatarUri ?? null,
    chats: [...scope.ungrouped, ...scope.groups.flatMap((group) => group.chats)],
    conversationGroups: scope.groups
  }));
  const projected = sections.map((section) => {
    const chats = section.chats.flatMap((chat) => {
      const updated = live.get(chat.id);
      return updated === void 0 ? [] : [updated];
    }).sort(compareSidebarChats);
    const scope = conversationSidebarScope({ ...section, chats });
    for (const group of scope.groups) group.id = section.conversationGroups?.find((previous) => previous.name === group.name)?.id ?? group.id;
    return { section: { ...section, chats, conversationGroups: scope.groups, ungroupedChats: scope.ungrouped }, scope };
  });
  return catalog.view === "characters" ? { view: "characters", sections: projected.map((value) => value.section) } : { view: "groups", scopes: projected.map((value) => value.scope) };
}

// src/ui/chat-sidebar/index.ui.ts
function Screen(ctx) {
  return renderSidebarScreen(ctx);
}

function __operitUiTemplate_22009(__ctx,__values){return __ctx.UI.Spacer({width:__values[0]}); }
function __operitUiTemplate_22093(__ctx,__values){return __ctx.UI.HoverOnly({key:__values[0],alwaysVisible:__values[1]},__values[2]); }
function __operitUiTemplate_22540(__ctx,__values){return __ctx.UI.ActivityDots({key:__values[0],width:10,height:13.5,running:__values[1],selected:__values[2],restingColor:__values[3],activeColor:__values[4]}); }
function __operitUiTemplate_23206(__ctx,__values){return __ctx.UI.Text({text:__values[0],weight:1,maxLines:1,overflow:"ellipsis",fontSize:13,color:__values[1]}); }
function __operitUiTemplate_23016(__ctx,__values){return __ctx.UI.Row({width:220,height:34,paddingHorizontal:10,verticalAlignment:"center",background:__values[0],backgroundShape:{cornerRadius:8}},__values[1]); }
function __operitUiTemplate_22861(__ctx,__values){return __ctx.UI.Draggable({key:__values[0],data:__values[1],dragType:__values[2],enabled:true,feedback:__values[3]},__values[4]); }
function __operitUiTemplate_23357(__ctx,__values){return __ctx.UI.Text(__values[0]); }
function __operitUiTemplate_23676(__ctx,__values){return __ctx.UI.Icon({name:"PushPin",size:12,tint:__values[0]}); }
function __operitUiTemplate_23833(__ctx,__values){return __ctx.UI.Icon({name:"Lock",size:12,tint:__values[0]}); }
function __operitUiTemplate_24137(__ctx,__values){return __ctx.UI.IconButton({key:__values[0],icon:__values[1],width:26,height:28,tooltip:__values[2],onClick:__values[3]}); }
function __operitUiTemplate_24671(__ctx,__values){return __ctx.UI.Row({key:__values[0],weight:1,height:31,verticalAlignment:"center",paddingHorizontal:6,modifier:__values[1]},__values[2]); }
function __operitUiTemplate_25664(__ctx,__values){return __ctx.UI.Box({key:__values[0],width:1,height:__values[1],backgroundColor:__values[2]}); }
function __operitUiTemplate_25860(__ctx,__values){return __ctx.UI.Box({key:__values[0],width:__values[1],height:__values[2],backgroundColor:__values[3],backgroundShape:{cornerRadius:1.5},animation:{durationMillis:160,curve:"easeOutCubic"},hoverStyle:{width:2,height:__values[4],backgroundColor:__values[5]}}); }
function __operitUiTemplate_25506(__ctx,__values){return __ctx.UI.Box({key:__values[0],width:__values[1],height:__values[2],contentAlignment:"center"},[__values[3],__values[4]]); }
function __operitUiTemplate_27804(__ctx,__values){return __ctx.UI.Icon({name:"Edit",size:__values[0],width:__values[1],height:__values[2],tint:__values[3]}); }
function __operitUiTemplate_27664(__ctx,__values){return __ctx.UI.Box({fillMaxSize:true,paddingStart:12,background:__values[0],contentAlignment:"start"},__values[1]); }
function __operitUiTemplate_28110(__ctx,__values){return __ctx.UI.Icon({name:"Delete",size:__values[0],width:__values[1],height:__values[2],tint:__values[3]}); }
function __operitUiTemplate_27976(__ctx,__values){return __ctx.UI.Box({fillMaxSize:true,paddingEnd:12,background:__values[0],contentAlignment:"end"},__values[1]); }
function __operitUiTemplate_27292(__ctx,__values){return __ctx.UI.SwipeActions({key:__values[0],actionThreshold:0.5,height:31,modifier:__values[1],onStartAction:__values[2],onEndAction:__values[3],startBackground:__values[4],endBackground:__values[5]},__values[6]); }
function __operitUiTemplate_27130(__ctx,__values){return __ctx.UI.HoverRegion({weight:1,hoverBackground:__values[0],shape:{cornerRadius:__values[1]}},__values[2]); }
function __operitUiTemplate_26835(__ctx,__values){return __ctx.UI.Row({key:__values[0],fillMaxWidth:true,height:__values[1],paddingStart:__values[2],paddingEnd:__values[3],verticalAlignment:"center"},[__values[4],__values[5],__values[6]]); }
function __operitUiTemplate_26737(__ctx,__values){return __ctx.UI.HoverRegion({key:__values[0],fillMaxWidth:true},__values[1]); }
function __operitUiTemplate_26364(__ctx,__values){return __ctx.UI.DragTarget({key:__values[0],acceptedTypes:[__values[1]],excludedData:[__values[2]],hoverBorderColor:__values[3],shape:{cornerRadius:8},fillMaxWidth:true,onDrop:__values[4]},__values[5]); }
function __operitUiTemplate_29678(__ctx,__values){return __ctx.UI.Icon({name:__values[0],size:18,tint:__values[1]}); }
function __operitUiTemplate_29810(__ctx,__values){return __ctx.UI.Text({text:__values[0],style:"labelMedium",fontWeight:"600",color:__values[1]}); }
function __operitUiTemplate_29374(__ctx,__values){return __ctx.UI.Row({key:__values[0],fillMaxWidth:true,paddingStart:__values[1],paddingEnd:__values[2],paddingTop:2,height:34,verticalAlignment:"center",spacing:8,onClick:__values[3]},[__values[4],__values[5]]); }
function __operitUiTemplate_30161(__ctx,__values){return __ctx.UI.Image({key:__values[0],uri:__values[1],width:__values[2],height:__values[3],contentScale:"crop",contentDescription:__values[4],modifier:__values[5]}); }
function __operitUiTemplate_30719(__ctx,__values){return __ctx.UI.Icon({name:__values[0],size:14,tint:__values[1]}); }
function __operitUiTemplate_30467(__ctx,__values){return __ctx.UI.Box({width:__values[0],height:__values[1],contentAlignment:"center",background:__values[2],backgroundShape:{type:"circle"}},__values[3]); }
function __operitUiTemplate_31603(__ctx,__values){return __ctx.UI.Text({text:__values[0],style:"titleSmall",fontWeight:"700",maxLines:1,overflow:"ellipsis",modifier:__values[1],color:__values[2]}); }
function __operitUiTemplate_31909(__ctx,__values){return __ctx.UI.Text({text:__values[0],style:"labelSmall",fontWeight:"700",color:__values[1]}); }
function __operitUiTemplate_32066(__ctx,__values){return __ctx.UI.GradientRule({weight:1,paddingHorizontal:10,height:2,startColor:__values[0],endColor:__values[1]}); }
function __operitUiTemplate_32255(__ctx,__values){return __ctx.UI.Icon({name:__values[0],size:23,tint:__values[1]}); }
function __operitUiTemplate_31306(__ctx,__values){return __ctx.UI.Row({fillMaxWidth:true,verticalAlignment:"center",height:24,onClick:__values[0],modifier:__values[1]},[__values[2],__values[3],__values[4],__values[5],__values[6],__values[7],__values[8]]); }
function __operitUiTemplate_31087(__ctx,__values){return __ctx.UI.DragTarget({key:__values[0],acceptedTypes:[__values[1]],onDrop:__values[2]},__values[3]); }
function __operitUiTemplate_30853(__ctx,__values){return __ctx.UI.Column({key:__values[0],fillMaxWidth:true,paddingStart:__values[1],paddingEnd:__values[2],paddingTop:5,paddingBottom:5},__values[3]); }
function __operitUiTemplate_33051(__ctx,__values){return __ctx.UI.Icon({name:"FolderOutlined",size:16,tint:__values[0]}); }
function __operitUiTemplate_33175(__ctx,__values){return __ctx.UI.Text({text:__values[0],weight:1,style:"labelLarge",fontWeight:"700",maxLines:1,overflow:"ellipsis",color:__values[1]}); }
function __operitUiTemplate_33373(__ctx,__values){return __ctx.UI.Icon({name:"PushPinRounded",size:12,tint:__values[0]}); }
function __operitUiTemplate_33515(__ctx,__values){return __ctx.UI.HoverOnly({width:24,height:24},__values[0]); }
function __operitUiTemplate_33645(__ctx,__values){return __ctx.UI.Icon({name:__values[0],size:20,tint:__values[1]}); }
function __operitUiTemplate_32571(__ctx,__values){return __ctx.UI.Row(__values[0],__values[1]); }
function __operitUiTemplate_34378(__ctx,__values){return __ctx.UI.HoverRegion({shape:{cornerRadius:__values[0]}},__values[1]); }
function __operitUiTemplate_34025(__ctx,__values){return __ctx.UI.DragTarget({key:__values[0],acceptedTypes:[__values[1]],hoverBorderColor:__values[2],shape:{cornerRadius:__values[3]},onDrop:__values[4]},__values[5]); }
function __operitUiTemplate_33801(__ctx,__values){return __ctx.UI.Column({key:__values[0],fillMaxWidth:true,paddingStart:__values[1],paddingEnd:__values[2],paddingTop:3,paddingBottom:3},__values[3]); }
function __operitUiTemplate_36628(__ctx,__values){return __ctx.UI.Text({text:__values[0],height:__values[1],color:__values[2],fontSize:12,paddingHorizontal:20}); }
function __operitUiTemplate_50469(__ctx,__values){return __ctx.UI.Icon({name:"MoreHoriz",size:16,tint:__values[0]}); }
function __operitUiTemplate_49617(__ctx,__values){return __ctx.UI.PopupMenu({key:__values[0],width:22,height:22,tooltip:"\u5BF9\u8BDD\u64CD\u4F5C",enabled:__values[1],items:[{label:"\u7F16\u8F91\u540D\u79F0",icon:"Edit"},{label:__values[2],icon:"PushPin"},{label:__values[3],icon:__values[4]},{label:"\u5220\u9664",icon:"DeleteOutline",danger:true}],onSelected:__values[5]},__values[6]); }
function __operitUiTemplate_51956(__ctx,__values){return __ctx.UI.Icon({name:"MoreHorizRounded",size:16,tint:__values[0]}); }
function __operitUiTemplate_50752(__ctx,__values){return __ctx.UI.PopupMenu({key:__values[0],width:22,height:22,menuMaxWidth:138,tooltip:"\u5206\u7EC4\u64CD\u4F5C",enabled:__values[1],items:[{label:"\u65B0\u5EFA\u5BF9\u8BDD",icon:"AddCommentOutlined"},{label:"\u7F16\u8F91\u540D\u79F0",icon:"EditOutlined"},{label:__values[2],icon:__values[3]},{label:"\u5220\u9664",icon:"DeleteOutlineRounded",danger:true,dividerBefore:true}],onSelected:__values[4]},__values[5]); }
function __operitUiTemplate_53338(__ctx,__values){return __ctx.UI.Icon({name:"MoreHorizRounded",size:16,tint:__values[0]}); }
function __operitUiTemplate_52554(__ctx,__values){return __ctx.UI.PopupMenu({key:__values[0],width:22,height:22,menuMaxWidth:138,tooltip:"\u5206\u7EC4\u64CD\u4F5C",items:__values[1],enabled:__values[2],onSelected:__values[3]},__values[4]); }
function __operitUiTemplate_56349(__ctx,__values){return __ctx.UI.Icon({name:"AddRounded",size:17,tint:__values[0]}); }
function __operitUiTemplate_56439(__ctx,__values){return __ctx.UI.Text(__values[0]); }
function __operitUiTemplate_55923(__ctx,__values){return __ctx.UI.Row({key:"sidebar-new-chat",weight:1,height:34,verticalAlignment:"center",horizontalArrangement:"center",onClick:__values[0],spacing:6},[__values[1],__values[2]]); }
function __operitUiTemplate_56604(__ctx,__values){return __ctx.UI.Box({width:1,height:16,background:__values[0]}); }
function __operitUiTemplate_57571(__ctx,__values){return __ctx.UI.Icon({name:"CreateNewFolderOutlined",size:16,tint:__values[0],contentDescription:"\u65B0\u5EFA\u5206\u7EC4"}); }
function __operitUiTemplate_56711(__ctx,__values){return __ctx.UI.Row({key:"sidebar-new-group",width:38,height:34,verticalAlignment:"center",horizontalArrangement:"center",onClick:__values[0]},__values[1]); }
function __operitUiTemplate_55850(__ctx,__values){return __ctx.UI.Row({fillMaxSize:true,verticalAlignment:"center"},[__values[0],__values[1],__values[2]]); }
function __operitUiTemplate_55607(__ctx,__values){return __ctx.UI.Surface({key:"sidebar-create-bar",weight:1,height:34,containerColor:__values[0],contentColor:__values[1],shape:{type:"pill"}},__values[2]); }
function __operitUiTemplate_58157(__ctx,__values){return __ctx.UI.Icon({name:__values[0],size:17,tint:__values[1],contentDescription:__values[2]}); }
function __operitUiTemplate_57732(__ctx,__values){return __ctx.UI.Row({key:"sidebar-search-toggle",width:34,height:34,verticalAlignment:"center",horizontalArrangement:"center",onClick:__values[0],modifier:__values[1],background:__values[2]},__values[3]); }
function __operitUiTemplate_55419(__ctx,__values){return __ctx.UI.Row({key:"sidebar-toolbar",fillMaxWidth:true,verticalAlignment:"center",spacing:8,paddingStart:14,paddingEnd:12,paddingBottom:8},[__values[0],__values[1]]); }
function __operitUiTemplate_59035(__ctx,__values){return __ctx.UI.Icon({name:"Search",size:20,tint:__values[0]}); }
function __operitUiTemplate_58736(__ctx,__values){return __ctx.UI.TextField({key:"sidebar-search",value:__values[0],onValueChange:__values[1],placeholder:"\u641C\u7D22\u5BF9\u8BDD",singleLine:true,fillMaxWidth:true,style:{color:__values[2]},leadingIcon:__values[3],decoration:{isDense:true,filled:true,fillColor:__values[4],cornerRadius:14,focusedBorderColor:__values[5],hintStyle:{color:__values[6]},contentPadding:{horizontal:12,vertical:10}}}); }
function __operitUiTemplate_58643(__ctx,__values){return __ctx.UI.Column({fillMaxWidth:true,paddingHorizontal:12,paddingBottom:12},__values[0]); }
function __operitUiTemplate_59512(__ctx,__values){return __ctx.UI.Spacer({height:0}); }
function __operitUiTemplate_58444(__ctx,__values){return __ctx.UI.Box({key:"sidebar-search-container",fillMaxWidth:true,animation:{durationMillis:180,curve:"easeOutCubic",animateContentSize:true}},__values[0]); }
function __operitUiTemplate_59583(__ctx,__values){return __ctx.UI.Text({key:"sidebar-error",text:__values[0],fontSize:11,color:__values[1],paddingHorizontal:20,paddingVertical:6}); }
function __operitUiTemplate_60483(__ctx,__values){return __ctx.UI.LoadingIndicator({size:24}); }
function __operitUiTemplate_60399(__ctx,__values){return __ctx.UI.Box({fillMaxWidth:true,height:80,contentAlignment:"center"},__values[0]); }
function __operitUiTemplate_60628(__ctx,__values){return __ctx.UI.Text({text:__values[0],fontSize:16,fontWeight:"600"}); }
function __operitUiTemplate_61234(__ctx,__values){return __ctx.UI.TextField({key:"sidebar-group-name",value:__values[0],label:__values[1],onValueChange:__values[2],enabled:__values[3]}); }
function __operitUiTemplate_61600(__ctx,__values){return __ctx.UI.Text({text:__values[0],fontSize:12}); }
function __operitUiTemplate_62108(__ctx,__values){return __ctx.UI.Text({text:__values[0],fillMaxWidth:true,maxLines:2,style:"titleMedium",color:__values[1]}); }
function __operitUiTemplate_62588(__ctx,__values){return __ctx.UI.Icon({name:__values[0],size:20,tint:__values[1]}); }
function __operitUiTemplate_62692(__ctx,__values){return __ctx.UI.Text({text:__values[0],weight:1,fontSize:14,color:__values[1]}); }
function __operitUiTemplate_62455(__ctx,__values){return __ctx.UI.Row({fillMaxWidth:true,paddingHorizontal:16,paddingVertical:10,verticalAlignment:"center",spacing:12},[__values[0],__values[1]]); }
function __operitUiTemplate_62309(__ctx,__values){return __ctx.UI.Surface({fillMaxWidth:true,onClick:__values[0],shape:{cornerRadius:12},color:__values[1]},__values[2]); }
function __operitUiTemplate_63660(__ctx,__values){return __ctx.UI.Text({key:"sidebar-delete-result",text:__values[0],fontSize:11,color:__values[1]}); }
function __operitUiTemplate_64027(__ctx,__values){return __ctx.UI.Text({text:__values[0],color:__values[1],fontSize:11}); }
function __operitUiTemplate_64148(__ctx,__values){return __ctx.UI.TextButton({text:"\u53D6\u6D88",enabled:__values[0],onClick:__values[1]}); }
function __operitUiTemplate_64326(__ctx,__values){return __ctx.UI.Button({text:"\u786E\u8BA4",enabled:__values[0],onClick:__values[1]}); }
function __operitUiTemplate_64113(__ctx,__values){return __ctx.UI.Row({spacing:8},__values[0]); }
function __operitUiTemplate_64612(__ctx,__values){return __ctx.UI.Column({padding:20,spacing:12,width:320},__values[0]); }
function __operitUiTemplate_64448(__ctx,__values){return __ctx.UI.Dialog({key:"sidebar-edit-dialog",closeOnDismissRequest:__values[0],onDismissRequest:__values[1]},__values[2]); }
function __operitUiTemplate_64813(__ctx,__values){return __ctx.UI.Column({key:"native-character-sidebar",fillMaxWidth:true,paddingBottom:16,spacing:0,onLoad:__values[0],onInputsChanged:__values[1]},__values[2]); }