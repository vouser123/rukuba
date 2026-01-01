(function (global) {
    const CUSTOM_VALUE = '__custom__';

    function getExerciseSchema(schema) {
        if (!schema || typeof schema !== 'object') return null;
        if (schema.$defs && schema.$defs.exercise) return schema.$defs.exercise;
        if (schema.definitions && schema.definitions.exercise) return schema.definitions.exercise;
        if (schema.properties && schema.required) return schema;
        return null;
    }

    function getRoleSchema(schema) {
        if (!schema || typeof schema !== 'object') return null;
        if (schema.definitions && schema.definitions.role) return schema.definitions.role;
        return null;
    }

    function cloneValue(value) {
        if (value === null || value === undefined) return value;
        if (Array.isArray(value)) return value.map(item => cloneValue(item));
        if (typeof value === 'object') {
            return Object.keys(value).reduce((acc, key) => {
                acc[key] = cloneValue(value[key]);
                return acc;
            }, {});
        }
        return value;
    }

    function toArray(value) {
        if (value === undefined || value === null) return [];
        return Array.isArray(value) ? value : [value];
    }

    function getDefaultValue(fieldSchema) {
        if (!fieldSchema || typeof fieldSchema !== 'object') return null;
        if (Object.prototype.hasOwnProperty.call(fieldSchema, 'default')) {
            return cloneValue(fieldSchema.default);
        }

        const types = toArray(fieldSchema.type);
        if (types.includes('null')) {
            return null;
        }

        const primaryType = types[0];

        if (primaryType === 'array') {
            return [];
        }

        if (primaryType === 'object') {
            const obj = {};
            if (fieldSchema.properties) {
                Object.keys(fieldSchema.properties).forEach(propName => {
                    obj[propName] = getDefaultValue(fieldSchema.properties[propName]);
                });
            }
            return obj;
        }

        if (primaryType === 'string') {
            if (fieldSchema.enum && fieldSchema.enum.length > 0) {
                return fieldSchema.enum[0];
            }
            return '';
        }

        if (primaryType === 'number' || primaryType === 'integer') {
            return 0;
        }

        if (primaryType === 'boolean') {
            return false;
        }

        return null;
    }

    function getExerciseFieldDefinitions(schema) {
        const exerciseSchema = getExerciseSchema(schema);
        if (!exerciseSchema) return {};
        const requiredFields = new Set(exerciseSchema.required || []);
        const props = exerciseSchema.properties || {};

        return Object.keys(props).reduce((acc, key) => {
            const propSchema = props[key];
            acc[key] = {
                required: requiredFields.has(key),
                defaultValue: getDefaultValue(propSchema),
                schema: propSchema
            };
            return acc;
        }, {});
    }

    function buildExerciseDefaults(schema, restrictToFields) {
        const exerciseSchema = getExerciseSchema(schema);
        if (!exerciseSchema) return {};
        const props = exerciseSchema.properties || {};
        const allowed = restrictToFields ? new Set(restrictToFields) : null;
        const defaults = {};

        Object.keys(props).forEach(key => {
            if (allowed && !allowed.has(key)) return;
            defaults[key] = getDefaultValue(props[key]);
        });

        return defaults;
    }

    function mergeDefaults(target, defaults) {
        const result = { ...target };
        Object.keys(defaults).forEach(key => {
            if (result[key] === undefined) {
                result[key] = cloneValue(defaults[key]);
                return;
            }
            if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
                result[key] = mergeDefaults(result[key] || {}, defaults[key]);
            }
        });
        return result;
    }

    function normalizeExercise(exercise, schema, options = {}) {
        const defaults = buildExerciseDefaults(schema, options.restrictToFields);
        const base = exercise ? cloneValue(exercise) : {};
        return mergeDefaults(base, defaults);
    }

    function getPatternLabel(pattern) {
        if (pattern === 'side') return 'side (unilateral - one side at a time)';
        if (pattern === 'both') return 'both (bilateral - both sides together)';
        return pattern;
    }

    function normalizeWhitespace(value) {
        return value.replace(/\s+/g, ' ').trim();
    }

    function toSentenceCase(value) {
        if (!value) return '';
        const cleaned = normalizeWhitespace(value.replace(/_/g, ' ')).toLowerCase();
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    function toTitleCase(value) {
        if (!value) return '';
        const cleaned = normalizeWhitespace(value.replace(/_/g, ' ')).toLowerCase();
        return cleaned.split(' ').map(word => {
            if (!word) return '';
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    }

    function toLowerSnakeCase(value) {
        if (!value) return '';
        return normalizeWhitespace(value.replace(/_/g, ' ')).toLowerCase().replace(/\s+/g, '_');
    }

    function normalizeValueWithStrategy(value, strategy) {
        if (value === null || value === undefined) return value;
        const trimmed = typeof value === 'string' ? value.trim() : value;
        if (strategy === 'title') return toTitleCase(trimmed);
        if (strategy === 'sentence') return toSentenceCase(trimmed);
        if (strategy === 'lower_snake') return toLowerSnakeCase(trimmed);
        return trimmed;
    }

    function normalizeValueForPath(path, value) {
        if (typeof value !== 'string') return value;
        const fieldPath = path || '';
        if (fieldPath === 'canonical_name' || fieldPath.endsWith('.canonical_name')) return toTitleCase(value);
        if (fieldPath === 'pt_category' || fieldPath.endsWith('.pt_category')) return toLowerSnakeCase(value);
        if (fieldPath === 'primary_muscles' || fieldPath === 'secondary_muscles') {
            return toSentenceCase(value);
        }
        if (fieldPath.endsWith('.primary_muscles') || fieldPath.endsWith('.secondary_muscles')) {
            return toSentenceCase(value);
        }
        if (fieldPath.startsWith('equipment.')) {
            return toSentenceCase(value);
        }
        return value.trim();
    }

    function buildSelectOptionsHtml(options, config = {}) {
        const placeholder = config.placeholder || '-- Select --';
        const includeCustom = config.includeCustom || false;
        const customLabel = config.customLabel || '➕ Other (custom)...';
        const customValue = config.customValue || CUSTOM_VALUE;
        const labelFormatter = config.labelFormatter || (value => value);

        let html = `<option value="">${placeholder}</option>`;
        options.forEach(option => {
            html += `<option value="${option}">${labelFormatter(option)}</option>`;
        });
        if (includeCustom) {
            html += `<option value="${customValue}">${customLabel}</option>`;
        }
        return html;
    }

    function populateSelectElement(selectElem, options, config = {}) {
        if (!selectElem) return;
        selectElem.innerHTML = buildSelectOptionsHtml(options, config);
    }

    function populateExerciseSelect({ selectId, exercises, placeholder }) {
        const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
        if (!select) return;
        const label = placeholder || '-- Choose an exercise --';
        select.innerHTML = `<option value="">${label}</option>`;
        if (!exercises || exercises.length === 0) return;
        exercises.forEach(ex => {
            const option = document.createElement('option');
            option.value = ex.id;
            option.textContent = ex.canonical_name || ex.title || ex.name || ex.id;
            select.appendChild(option);
        });
    }

    function populatePatternSelect({ selectId, schema }) {
        const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
        if (!select) return;
        const exerciseSchema = getExerciseSchema(schema);
        const patterns = exerciseSchema?.properties?.pattern?.enum || [];
        select.innerHTML = '<option value="">-- Select --</option>';
        patterns.forEach(pattern => {
            const option = document.createElement('option');
            option.value = pattern;
            option.textContent = getPatternLabel(pattern);
            select.appendChild(option);
        });
    }

    function populatePtCategoryDatalist({ datalistId, schema }) {
        const datalist = typeof datalistId === 'string' ? document.getElementById(datalistId) : datalistId;
        if (!datalist) return;
        const exerciseSchema = getExerciseSchema(schema);
        const categories = exerciseSchema?.properties?.pt_category?.enum || [];
        datalist.innerHTML = categories.map(category => `<option value="${category}"></option>`).join('');
    }

    function populatePatternModifiersHelp({ containerId, vocabulary }) {
        const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        if (!container || !vocabulary || !vocabulary.pattern_modifiers) return;
        const modifierDefs = vocabulary.pattern_modifiers;
        const helpLines = Object.keys(modifierDefs).map(key => `<strong>${key}</strong>: ${modifierDefs[key]}`);
        container.innerHTML = helpLines.join('<br>');
    }

    function getPatternModifierOptions(schema) {
        const exerciseSchema = getExerciseSchema(schema);
        return exerciseSchema?.properties?.pattern_modifiers?.items?.enum || [];
    }

    function getEquipmentOptions({ schema, exerciseLibrary, type }) {
        const options = new Set();
        const exerciseSchema = getExerciseSchema(schema);
        const enumValues = exerciseSchema?.properties?.equipment?.properties?.[type]?.items?.enum
            || schema?.$defs?.equipment?.properties?.[type]?.items?.enum
            || schema?.definitions?.equipment?.properties?.[type]?.items?.enum
            || [];
        enumValues.forEach(item => options.add(item));

        if (exerciseLibrary && exerciseLibrary.length > 0) {
            exerciseLibrary.forEach(ex => {
                const items = ex.equipment?.[type] || [];
                items.forEach(item => {
                    if (item) options.add(item);
                });
            });
        }

        return Array.from(options).sort();
    }

    function getFormParameterOptions({ schema, exerciseLibrary }) {
        const options = new Set();
        const exerciseSchema = getExerciseSchema(schema);
        const enumValues = exerciseSchema?.properties?.form_parameters_required?.items?.enum || [];
        enumValues.forEach(item => options.add(item));

        if (exerciseLibrary && exerciseLibrary.length > 0) {
            exerciseLibrary.forEach(ex => {
                const items = ex.form_parameters_required || [];
                items.forEach(item => {
                    if (item) options.add(item);
                });
            });
        }

        return Array.from(options).sort();
    }

    function getRoleEnumValues({ schema, vocabulary, rolesData, key }) {
        const options = new Set();
        const roleSchema = getRoleSchema(schema);
        const schemaEnum = roleSchema?.properties?.[key]?.enum || [];
        schemaEnum.forEach(value => options.add(value));

        const vocabKeyMap = {
            region: ['region', 'regions'],
            capacity: ['capacity', 'capacities'],
            focus: ['focus', 'focuses']
        };
        const vocabKeys = vocabKeyMap[key] || [key, `${key}s`];
        vocabKeys.forEach(vocabKey => {
            const vocab = vocabulary?.[vocabKey];
            if (vocab && typeof vocab === 'object') {
                Object.keys(vocab).forEach(value => options.add(value));
            }
        });

        if (rolesData && rolesData.exercise_roles) {
            Object.values(rolesData.exercise_roles).forEach(ex => {
                (ex.roles || []).forEach(role => {
                    if (role && role[key]) options.add(role[key]);
                });
            });
        }

        return Array.from(options).sort();
    }

    function getContributionOptions({ schema, vocabulary }) {
        const options = new Set();
        const roleSchema = getRoleSchema(schema);
        const schemaEnum = roleSchema?.properties?.contribution?.enum || [];
        schemaEnum.forEach(value => options.add(value));

        if (vocabulary?.contribution) {
            Object.keys(vocabulary.contribution).forEach(value => options.add(value));
        }

        const ordered = ['high', 'medium', 'low'];
        const orderedOptions = ordered.filter(value => options.has(value));
        const remaining = Array.from(options).filter(value => !ordered.includes(value)).sort();
        return [...orderedOptions, ...remaining];
    }

    function populateRoleSelects({ regionSelectId, capacitySelectId, focusSelectId, contributionSelectId, schema, vocabulary, rolesData }) {
        const regionSelect = typeof regionSelectId === 'string' ? document.getElementById(regionSelectId) : regionSelectId;
        const capacitySelect = typeof capacitySelectId === 'string' ? document.getElementById(capacitySelectId) : capacitySelectId;
        const focusSelect = typeof focusSelectId === 'string' ? document.getElementById(focusSelectId) : focusSelectId;
        const contributionSelect = typeof contributionSelectId === 'string' ? document.getElementById(contributionSelectId) : contributionSelectId;

        const regions = getRoleEnumValues({ schema, vocabulary, rolesData, key: 'region' });
        const capacities = getRoleEnumValues({ schema, vocabulary, rolesData, key: 'capacity' });
        const focuses = getRoleEnumValues({ schema, vocabulary, rolesData, key: 'focus' });
        const contributions = getContributionOptions({ schema, vocabulary });

        if (regionSelect) {
            populateSelectElement(regionSelect, regions, {
                placeholder: '-- Select region --',
                includeCustom: true
            });
        }

        if (capacitySelect) {
            populateSelectElement(capacitySelect, capacities, {
                placeholder: '-- Select capacity --',
                includeCustom: true
            });
        }

        if (focusSelect) {
            populateSelectElement(focusSelect, focuses, {
                placeholder: '-- No focus (general) --',
                includeCustom: true
            });
        }

        if (contributionSelect) {
            populateSelectElement(contributionSelect, contributions, {
                placeholder: '-- Select --',
                includeCustom: false,
                labelFormatter: value => value.charAt(0).toUpperCase() + value.slice(1)
            });
        }
    }

    function getVocabularyCategoryOptions(vocabulary) {
        const fallback = ['region', 'capacity', 'contribution', 'focus'];
        if (!vocabulary || typeof vocabulary !== 'object') return fallback;
        const categoryChecks = {
            region: vocabulary.region || vocabulary.regions,
            capacity: vocabulary.capacity || vocabulary.capacities,
            contribution: vocabulary.contribution || vocabulary.contributions,
            focus: vocabulary.focus || vocabulary.focuses
        };
        const categories = fallback.filter(key => categoryChecks[key]);
        return categories.length > 0 ? categories : fallback;
    }

    function getVocabularyTerms(vocabulary, category) {
        if (!vocabulary || !category) return [];
        const categoryMap = {
            region: ['region', 'regions'],
            capacity: ['capacity', 'capacities'],
            focus: ['focus', 'focuses'],
            contribution: ['contribution', 'contributions']
        };
        const keys = categoryMap[category] || [category, `${category}s`];
        const terms = new Set();
        keys.forEach(key => {
            const vocab = vocabulary[key];
            if (vocab && typeof vocab === 'object') {
                Object.keys(vocab).forEach(term => terms.add(term));
            }
        });
        return Array.from(terms).sort();
    }

    function getVocabularyMap(vocabulary, category) {
        if (!vocabulary || !category) return null;
        const categoryMap = {
            region: ['region', 'regions'],
            capacity: ['capacity', 'capacities'],
            focus: ['focus', 'focuses'],
            contribution: ['contribution', 'contributions']
        };
        const keys = categoryMap[category] || [category, `${category}s`];
        for (const key of keys) {
            const vocab = vocabulary[key];
            if (vocab && typeof vocab === 'object') {
                return vocab;
            }
        }
        return null;
    }

    function populateVocabCategorySelect({ selectId, vocabulary }) {
        const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
        if (!select) return;
        const categories = getVocabularyCategoryOptions(vocabulary);
        const options = categories.map(category => ({
            value: category,
            label: category.replace(/_/g, ' ')
        }));
        select.innerHTML = '<option value=\"\">-- Choose category --</option>' + options.map(option => {
            return `<option value=\"${option.value}\">${option.label.charAt(0).toUpperCase() + option.label.slice(1)}</option>`;
        }).join('');
    }

    function populateVocabTermSelect({ selectId, vocabulary, category }) {
        const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
        if (!select) return;
        const terms = getVocabularyTerms(vocabulary, category);
        select.innerHTML = '<option value=\"\">-- Choose term --</option>';
        terms.forEach(term => {
            select.innerHTML += `<option value=\"${term}\">${term.replace(/_/g, ' ')}</option>`;
        });
    }

    function setSelectValueWithCustom(selectId, value) {
        const selectElem = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
        if (!selectElem) return;
        const customElem = document.getElementById(`${selectElem.id}-custom`);

        if (!value) {
            selectElem.value = '';
            if (customElem) {
                customElem.style.display = 'none';
                customElem.value = '';
            }
            return;
        }

        const optionExists = Array.from(selectElem.options).some(option => option.value === value);
        if (optionExists) {
            selectElem.value = value;
            if (customElem) {
                customElem.style.display = 'none';
                customElem.value = '';
            }
        } else {
            selectElem.value = CUSTOM_VALUE;
            if (customElem) {
                customElem.style.display = 'block';
                customElem.value = value;
            }
        }
    }

    function readSelectValueWithCustom(selectElem) {
        if (!selectElem) return '';
        let value = selectElem.value;
        if (value === CUSTOM_VALUE) {
            const customElem = document.getElementById(`${selectElem.id}-custom`);
            value = customElem ? customElem.value.trim() : '';
        } else {
            value = value.trim();
        }
        return value;
    }

    function toggleCustomInputById(selectId) {
        const selectElem = document.getElementById(selectId);
        const customElem = document.getElementById(`${selectId}-custom`);
        if (!selectElem || !customElem) return;

        if (selectElem.value === CUSTOM_VALUE) {
            customElem.style.display = 'block';
            customElem.focus();
        } else {
            customElem.style.display = 'none';
            customElem.value = '';
        }
    }

    function readArrayFromElements(selector, options = {}) {
        const elements = document.querySelectorAll(selector);
        const values = [];
        elements.forEach(element => {
            let value = '';
            if (options.useCustomSelect) {
                value = readSelectValueWithCustom(element);
            } else {
                value = element.value.trim();
            }
            if (value) values.push(value);
        });
        return values;
    }

    function serializeExerciseFromBindings({ bindings, schema, id, generateId }) {
        const restrictToFields = bindings.restrictToFields || null;
        let exercise = normalizeExercise({ id: id || (generateId ? generateId() : undefined) }, schema, { restrictToFields });

        Object.keys(bindings.fields || {}).forEach(fieldName => {
            const fieldConfig = bindings.fields[fieldName];
            const element = document.getElementById(fieldConfig.id);
            if (!element) return;
            const rawValue = element.value;
            const value = fieldConfig.trim ? rawValue.trim() : rawValue;
            const normalized = normalizeValueWithStrategy(value, fieldConfig.normalize);
            if (fieldConfig.nullIfBlank && value === '') {
                exercise[fieldName] = null;
            } else {
                exercise[fieldName] = normalized;
            }
        });

        Object.keys(bindings.arrayFields || {}).forEach(fieldName => {
            const config = bindings.arrayFields[fieldName];
            const values = readArrayFromElements(config.selector, {
                useCustomSelect: config.useCustomSelect
            });
            exercise[fieldName] = config.normalize
                ? values.map(item => normalizeValueWithStrategy(item, config.normalize))
                : values.map(item => normalizeValueForPath(fieldName, item));
        });

        Object.keys(bindings.nestedArrayFields || {}).forEach(parentField => {
            exercise[parentField] = exercise[parentField] || {};
            const group = bindings.nestedArrayFields[parentField];
            Object.keys(group).forEach(childField => {
                const config = group[childField];
                const values = readArrayFromElements(config.selector, {
                    useCustomSelect: config.useCustomSelect
                });
                const fullPath = `${parentField}.${childField}`;
                exercise[parentField][childField] = config.normalize
                    ? values.map(item => normalizeValueWithStrategy(item, config.normalize))
                    : values.map(item => normalizeValueForPath(fullPath, item));
            });
        });

        if (bindings.staticFields) {
            exercise = mergeDefaults(exercise, bindings.staticFields);
        }

        return exercise;
    }

    function hydrateExerciseToBindings({ exercise, bindings }) {
        Object.keys(bindings.fields || {}).forEach(fieldName => {
            const fieldConfig = bindings.fields[fieldName];
            const element = document.getElementById(fieldConfig.id);
            if (!element) return;
            const value = exercise[fieldName] || '';
            element.value = normalizeValueWithStrategy(value, fieldConfig.normalize);
        });

        Object.keys(bindings.arrayFields || {}).forEach(fieldName => {
            const config = bindings.arrayFields[fieldName];
            const values = exercise[fieldName] || [];
            values.forEach(value => {
                const normalizedValue = config.normalize
                    ? normalizeValueWithStrategy(value, config.normalize)
                    : normalizeValueForPath(fieldName, value);
                if (typeof config.addItem === 'function') {
                    config.addItem(normalizedValue);
                }
            });
        });

        Object.keys(bindings.nestedArrayFields || {}).forEach(parentField => {
            const group = bindings.nestedArrayFields[parentField];
            const values = exercise[parentField] || {};
            Object.keys(group).forEach(childField => {
                const config = group[childField];
                const items = values[childField] || [];
                items.forEach(value => {
                    const fullPath = `${parentField}.${childField}`;
                    const normalizedValue = config.normalize
                        ? normalizeValueWithStrategy(value, config.normalize)
                        : normalizeValueForPath(fullPath, value);
                    if (typeof config.addItem === 'function') {
                        config.addItem(normalizedValue);
                    }
                });
            });
        });
    }

    function validateExercise(exercise, schema, restrictToFields) {
        const errors = [];
        const exerciseSchema = getExerciseSchema(schema);
        if (!exerciseSchema) return errors;
        const requiredFields = exerciseSchema.required || [];
        const properties = exerciseSchema.properties || {};

        requiredFields.forEach(fieldName => {
            if (restrictToFields && !restrictToFields.includes(fieldName)) return;
            const property = properties[fieldName];
            if (!property) return;

            const allowsNull = Array.isArray(property.type) ? property.type.includes('null') : false;
            const hasDefault = Object.prototype.hasOwnProperty.call(property, 'default');

            if (!allowsNull && !hasDefault) {
                const value = exercise[fieldName];
                let isEmpty = false;

                if (value === null || value === undefined || value === '') {
                    isEmpty = true;
                } else if (Array.isArray(value) && value.length === 0) {
                    if (property.minItems && property.minItems > 0) {
                        isEmpty = true;
                    }
                }

                if (isEmpty) {
                    const readableName = fieldName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    errors.push(`- ${readableName} is required`);
                }
            }
        });

        return errors;
    }

    function createEmptyExercise({ schema, id }) {
        const exerciseSchema = getExerciseSchema(schema) || schema;
        const props = exerciseSchema?.properties || {};
        const exercise = { id };

        Object.keys(props).forEach(fieldName => {
            if (fieldName === 'id') return;
            exercise[fieldName] = getDefaultValue(props[fieldName]);
        });

        return exercise;
    }

    const moduleApi = {
        CUSTOM_VALUE,
        getExerciseSchema,
        getExerciseFieldDefinitions,
        getDefaultValue,
        buildExerciseDefaults,
        normalizeExercise,
        buildSelectOptionsHtml,
        normalizeValueWithStrategy,
        normalizeValueForPath,
        populateExerciseSelect,
        populatePatternSelect,
        populatePtCategoryDatalist,
        populatePatternModifiersHelp,
        getPatternModifierOptions,
        getEquipmentOptions,
        getFormParameterOptions,
        populateRoleSelects,
        populateVocabCategorySelect,
        populateVocabTermSelect,
        getVocabularyMap,
        setSelectValueWithCustom,
        readSelectValueWithCustom,
        toggleCustomInputById,
        serializeExerciseFromBindings,
        hydrateExerciseToBindings,
        validateExercise,
        createEmptyExercise
    };

    global.exerciseFormModule = moduleApi;
})(window);
