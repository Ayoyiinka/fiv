<?php
/**
 * Copyright © 2015 Frame . All rights reserved.
 */
namespace Frame\Design\Block\FrameDesign;
use Frame\Design\Block\BaseBlock;
class Index extends BaseBlock
{
	protected $_productCollectionFactory;
	protected $_coreRegistry;
    protected $_imageHelper;
    //protected $_request;
    
	
	public function __construct(
	        \Frame\Design\Block\Context $context,
	       // \Magento\Framework\App\Request\Http $request,
	       //  \Magento\Framework\Registry $coreRegistry,   
	        \Magento\Catalog\Model\ResourceModel\Product\CollectionFactory $productCollectionFactory
	    )
	    {
			parent::__construct($context);
			$this->_coreRegistry = $context->getRegistry();
			$this->_productCollectionFactory = $productCollectionFactory;
			
		
		}

    
    public function getFramesProducts()
    {
        $collection = $this->_productCollectionFactory->create();
        $collection->addAttributeToSelect('*'); 
		$collection->addAttributeToFilter('visibility', 4);
        return $collection;
    }	
	
}
