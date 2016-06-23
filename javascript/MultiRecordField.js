(function($) {
	$.entwine('ss.multirecordediting', function($) {
		//
		// Template System
		//
		var _cache = {};

		function hasTemplate(name) {
			return (typeof _cache[name] !== 'undefined');
		}

		function renderString(string, variables) {
			for (var i = 0; i < variables.length; ++i)
			{
				var it = variables[i];
				var index = i + 1;
				for (var key in it)
				{
					string = string.replace(new RegExp('o-multirecordediting-'+index+'-'+key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), it[key]);
				}
			}
			return string;
		}

		function getTemplate(name, html) {
			return _cache[name];
		}

		function setTemplate(name, html) {
			_cache[name] = html;
		}

		//
		// Sort
		//

		function getIDTree(element) {
			//
			// Prepare the variables to replace in deeply nested field names, ie.
			// ie. ElementArea__MultiRecordEditingField__ElementGallery__o-multirecordediting-1-id__Images__MultiRecordEditingField__ElementGallery_Item__o-multirecordediting-2-id__Items__MultiRecordEditingField__ElementGallery_Item_Item__o-multirecordediting-3-id__Name
			// -becomes:-
			// ElementArea__MultiRecordEditingField__ElementGallery__new_1__Images__MultiRecordEditingField__ElementGallery_Item__new_1__Items__MultiRecordEditingField__ElementGallery_Item_Item__new_1__Name
			//
			var renderTree = [];
			var $parents = $(element).parents('.js-multirecordfield-list-item');
			for (var i = $parents.length - 1; i >= 0; --i)
			{
				// NOTE(Jake): We want to iterate from top to bottom, so iterate in reverse. (not bottom-to-top)
				var $it = $($parents[i]);
				var subID = $it.data('id');
				renderTree.push({ 
					id: subID,
				});
			}
			return renderTree;
		}

		// Pass in '.js-multirecordfield-list' and it'll update the sort value to match
		// the order of elements.
		function sortUpdate($list) {
			var changed = false;

			$list.children().each(function(index) {
				var sortValue = index + 1;
				// NOTE(Jake): Finds the .first() because otherwise it could set all unrelated
				//			   sort fields in nested MultiRecordEditingField's.
				var $sortField = $(this).find('.js-multirecordfield-sort-field').first();
				if ($sortField.val() != sortValue.toString()) {
					$sortField.val(sortValue.toString());
					changed = true;
				}
			});

			if (changed)
			{
				// Set CMS flag so it says 'You have unsaved changes, are you sure you want to leave?'
				$('.cms-edit-form').addClass('changed');
 			}
		}

		var isSorting = false;
		$('.js-multirecordfield-list-item').entwine({
			onadd: function() {
				var self = this;

				// Avoid accordions from ToggleCompositeField opening when
				// sorting.
				self.find('.ss-toggle').accordion({
					beforeActivate: function(e, data) {
						if (isSorting) { return false; }
					}
				});

				function helper(e, row) {
					var result = row.clone()
			          .addClass("is-helper")
			          .width(row.parent().width());

			        row.find('textarea.htmleditor').each(function(){
						tinymce.execCommand('mceRemoveEditor', false, $(this).attr('id'));
				    });

				    return result;
				}

				function start(e) {
					isSorting = true;
				}

				function update(e) {
					isSorting = false;
				}

				function stop(e) {
					sortUpdate(self.parent());

					// HTMLEditorField support
					$(this).find('textarea.htmleditor').each(function(){
						tinymce.execCommand('mceAddEditor', true, $(this).attr('id'));
					});
				}

				this.parent().sortable({
					handle: '.js-multirecordfield-sort-handle',
					helper: helper,
					opacity: 0.7,
					start: start,
					update: update,
					stop: stop
				});
			}
		});

		// Replace o-multirecordediting-* template variable with value when
		// the <input type="hidden"> tag is created after a file is selected/uploaded
		$('.ss-uploadfield-item-info input').entwine({
			onmatch: function() {
				this._super();
				var name = this.attr('name');
				if (name && name.indexOf('o-multirecordediting') > -1)
				{
					var renderTree = getIDTree(this);
					var newName = renderString(name, renderTree);
					if (newName !== name)
					{
						$(this).attr('name', newName);
					}
				}
			},
			onunmatch: function() {
				this._super();
			}
		});

		//
		// I/O
		//
		$('select.js-multirecordfield-classname').entwine({
			onmatch: function() {
				this._super();
				this.change();
			},
			onchange: function(e) {
				this._super();

				var self = this[0],
					$self = $(self);

				var $actions = $self.parents('.js-multirecordfield-actions');
				var $inlineAddButton = $actions.find('input.js-multirecordfield-add-inline, button.js-multirecordfield-add-inline');
				if ($inlineAddButton.length)
				{
					var className = $self.val();
					if (className)
					{
						$inlineAddButton.removeClass('is-disabled');
						if ($inlineAddButton.hasClass('ui-button')) {
							$inlineAddButton.button().button('enable');
						} else {
							$inlineAddButton.prop('disabled', false);
						}
					}
					else
					{
						$inlineAddButton.addClass('is-disabled');
						if ($inlineAddButton.hasClass('ui-button')) {
							$inlineAddButton.button().button('disable');
						} else {
							$inlineAddButton.prop('disabled', true);
						}
					}
				}
			}
		});

		$('input.js-multirecordfield-delete, button.js-multirecordfield-delete, a.js-multirecordfield-delete').entwine({
			onclick: function(e) {
				e.preventDefault();

				var self = this[0],
					$self = $(self),
				    $thisItem = $self.parents('.js-multirecordfield-list-item').first();

				if ($thisItem.hasClass('is-deleted'))
				{
					return;
				}

				var id = $thisItem.data('id').toString();
				/*if (id && id.indexOf('new') > -1)
				{
					// no-op
				}
				else
				{*/
					var $field = $self.parents('.js-multirecordfield-field').first();
					// NOTE(Jake): Finds the .first() because otherwise it could set all unrelated
					//			   sort fields in nested MultiRecordEditingField's.
					var $deletedList = $field.find('.js-multirecordfield-deleted-list').first();
					var name = $thisItem.data('name')+'__multirecordfield_delete';
					var $el = $('<input type="hidden" name="'+name+'" value="1" />').appendTo($deletedList);
					$thisItem.data('delete-input', $el);
				//}
				$thisItem.addClass('is-deleted');
			}
		});

		$('input.js-multirecordfield-undo, button.js-multirecordfield-undo, a.js-multirecordfield-undo').entwine({
			onclick: function(e) {
				e.preventDefault();

				var self = this[0],
					$self = $(self),
					$thisItem = $self.parents('.js-multirecordfield-list-item').first();

				if ($thisItem.hasClass('is-deleted'))
				{
					var $inputDelete = $thisItem.data('delete-input');
					if ($inputDelete)
					{
						$inputDelete.remove();
					}
					$thisItem.removeClass('is-deleted');
				}
			}
		});

		$('input.js-multirecordfield-add-inline, button.js-multirecordfield-add-inline').entwine({
			onclick: function(e) {
				e.preventDefault();
				var self = this[0],
					$self = $(self);

				if ($self.hasClass('is-disabled') || $self.is(":disabled") || $self.hasClass('is-loading')) {
					return;
				}

				var $actions, $dropdown, $loader;
				$actions = $self.parents('.js-multirecordfield-actions');
				$dropdown = $actions.find('select.js-multirecordfield-classname');

				var className;
				if ($dropdown.length) {
					className = $dropdown.val();
				} else {
					className = $self.data('class');
				}

				if (!className)
				{
					alert('Please select a section type.');
					return;
				}

				this.addinlinerecord(className, function(data) {
					var num = $self.data('add-inline-num') || 1;
					var depth = $self.data('depth');

					var renderTree = getIDTree($self);
					renderTree.push({ 
						id: 'new_'+num,
					});

					// Find field container ('js-multirecordfield-field') and add HTML
					// in the field list container.
					var $field = $self.parents('.js-multirecordfield-field').first();
					var $fieldList = $field.find('.js-multirecordfield-list').first();
					$fieldList.append(renderString(data, renderTree));
					sortUpdate($fieldList);

					$self.data('add-inline-num', num + 1);
				});

				this._super();
			},
			addinlinerecord: function(className, callback) {
				var self = this[0];
				var $self = $(self);

				if ($self.hasClass('is-loading')) {
					return;
				}

				var $form = $(self.form);
				var action = $form.attr('action');
				var fieldAction = $self.data('action');
				if (!fieldAction)
				{
					console.log('MultiRecordField::AddInlineRecord: Missing data-action attribute.');
					return;
				}
				var url = action+'/field/'+fieldAction+'/addinlinerecord';
				url += '/'+encodeURIComponent(className);

				// NOTE(Jake): Might need to include Formname or get the full URL as relative paths might
				//			   clash somehow.
				var templateID = url;

				if (!hasTemplate(templateID))
				{
					$actions = $self.parents('.js-multirecordfield-actions');
					$loader = $actions.find('.js-multirecordfield-loading');
					$self.addClass('is-loading');
					$loader.addClass('is-loading');

					$.ajax({
						async: true,
						url: url,
						success: function(data) {
							setTemplate(templateID, data);
							callback.apply(this, arguments);
						},
						error: function(xhr, status) {
							xhr.statusText = xhr.responseText;
						},
						complete: function() {
							$self.removeClass('is-loading');
							$loader.removeClass('is-loading');
						}
					});
				}
				else
				{
					var data = getTemplate(templateID);
					callback.apply(this, [data]);
				}

				this._super();
			}
		});
	});
})(jQuery);